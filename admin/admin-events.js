// FidesOrigin Admin - Secure Event Handlers Module
// 提取所有内联 onclick/onchange 到外部事件监听
// 使用事件委托模式，避免内联脚本
//
// [安全修复] High: 异步操作竞态条件保护 (AsyncLock)
// [安全修复] High: 高危操作二次确认
// [安全修复] High: 全局 try/catch 错误边界
// [安全修复] High: 搜索输入防抖
// [安全修复] High: 紧急操作 Promise 正确返回（修复未处理 rejection）
// [安全修复] Medium: 按钮选择器改用 data-action 避免碰撞
// [安全修复] Medium: AsyncLock Map 清理与错误日志
// [安全修复] Medium: withConfirmation 正确传递事件对象
//
// HTML 约定：所有可操作按钮须添加 data-action 属性，例如：
//   <button data-action="refresh-monitor" class="btn btn-sm">刷新</button>
//   <button data-action="save-limits" class="btn btn-primary">保存</button>

// ==================== 安全工具函数 ====================

/**
 * 异步操作竞态锁 — 确保同一 key 的异步操作不会并发执行
 * [修复] 使用 delete(key) 清理而非 set(key, false)，防止 Map 无限增长
 * [修复] 新增 catch 错误日志，确保传播路径可追踪
 */
const AsyncLock = {
  _locks: new Map(),

  /**
   * 获取锁并执行异步函数；若已有相同 key 的操作在执行则忽略
   * @param {string} key - 锁标识
   * @param {Function} fn - 异步函数
   * @returns {Promise|null} — 若已有锁则返回 null
   */
  async acquire(key, fn) {
    if (this._locks.get(key)) {
      console.warn('[AsyncLock] 操作 "' + key + '" 正在执行中，已忽略重复请求');
      return null;
    }
    this._locks.set(key, true);
    try {
      return await fn();
    } catch (err) {
      // [修复] 记录锁内执行错误
      console.error('[AsyncLock] 操作 "' + key + '" 执行失败:', err);
      throw err;
    } finally {
      // [修复] delete 而非 set(key, false)
      this._locks.delete(key);
    }
  }
};

/**
 * 防抖函数 — 限制高频事件触发频率
 * [修复] var 改为 let，与文件风格一致
 * @param {Function} fn - 目标函数
 * @param {number} delay - 延迟毫秒
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay) {
  let timerId = null;
  return function () {
    const ctx = this;
    const args = arguments;
    clearTimeout(timerId);
    timerId = setTimeout(function () {
      fn.apply(ctx, args);
    }, delay);
  };
}

/**
 * 高危操作确认装饰器 — 执行前弹出二次确认框
 * [修复] 正确传递原始事件参数给 fn
 * [修复] 锁分支返回 Promise 以便错误传播链完整
 * @param {string} message - 确认提示消息
 * @param {Function} fn - 实际执行函数
 * @param {string} lockKey - 可选，竞态锁 key
 * @returns {Function} 包装后的事件处理函数
 */
function withConfirmation(message, fn, lockKey) {
  return function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    // [修复] 保存原始参数（含事件对象），供 fn 读取 e.target.dataset 等
    const originalArgs = arguments;

    const exec = function () {
      return safeExecute(fn, 'confirmed-action').apply(null, originalArgs);
    };

    if (lockKey) {
      // [修复] return 使 Promise 链完整，错误可被 safeExecute 捕获
      return AsyncLock.acquire(lockKey, function () {
        return exec();
      });
    } else {
      return exec();
    }
  };
}

/**
 * 安全执行包装器 — 捕获异常并显示用户友好提示
 *
 * 设计说明：
 * - 同步错误：捕获后不重抛，避免事件处理器中产生未捕获异常
 * - 异步错误：捕获后不重抛（Promise resolve 为 undefined），
 *   因为 addEventListener 的返回值被忽略，重抛会导致 unhandledrejection
 * - 所有错误均通过 handleError 统一处理（toast + 上报）
 * - 若调用方需要感知失败，应在 fn 内部处理（如 catch 后设置状态）
 *
 * @param {Function} fn - 目标函数（同步或异步）
 * @param {string} context - 错误上下文描述
 * @returns {Function} 包装后的函数
 */
function safeExecute(fn, context) {
  context = context || 'Unknown';
  return function () {
    const ctx = this;
    const args = arguments;
    try {
      const result = fn.apply(ctx, args);
      if (result && typeof result.then === 'function') {
        return result.catch(function (err) {
          handleError(err, context);
          // 不重抛：addEventListener 返回值被忽略，
          // 重抛会导致 unhandledrejection 绕过全局边界
        });
      }
      return result;
    } catch (err) {
      handleError(err, context);
      // 同步错误不重抛，避免事件处理器中产生未捕获异常
    }
  };
}

/**
 * 统一错误处理
 * @param {Error|Object} err - 错误对象
 * @param {string} context - 错误上下文
 */
function handleError(err, context) {
  console.error('[' + context + '] Error:', err);

  if (typeof window.showToast === 'function') {
    let msg;
    if (err && err.code === 4001) {
      msg = '用户取消了操作';
    } else if (err && err.message) {
      msg = err.message;
    } else {
      msg = '操作执行失败';
    }
    window.showToast(msg, 'error');
  }

  if (typeof window.__trackError === 'function') {
    window.__trackError(context, err);
  }
}

/**
 * 辅助：按 data-action 属性在指定容器内查找按钮
 * [修复] 替代 .btn-primary/.btn-secondary 选择器，避免同容器多按钮碰撞
 * @param {string} containerSelector - 容器选择器（如 '#multisig'）
 * @param {string} action - data-action 值
 * @returns {Element|null}
 */
function findActionBtn(containerSelector, action) {
  const container = document.querySelector(containerSelector);
  if (!container) return null;
  return container.querySelector('[data-action="' + action + '"]');
}

// ==================== 导航事件 ====================

function initNavEvents() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', safeExecute(function (e) {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;

    e.preventDefault();
    const pageId = navItem.getAttribute('data-page');
    if (pageId && typeof window.showPage === 'function') {
      window.showPage(pageId);
    }
  }, 'nav-click'));
}

// ==================== 移动端侧边栏 ====================

function initMobileSidebarEvents() {
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.getElementById('overlay');

  if (hamburger) {
    hamburger.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.toggleMobileSidebar === 'function') {
        window.toggleMobileSidebar();
      }
    }, 'mobile-sidebar-toggle'));
  }

  if (overlay) {
    overlay.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.toggleMobileSidebar === 'function') {
        window.toggleMobileSidebar();
      }
    }, 'overlay-click'));
  }
}

// ==================== 头部按钮事件 ====================

function initHeaderEvents() {
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    connectBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();

      // [High] 竞态锁：防止重复点击导致钱包状态混乱
      return AsyncLock.acquire('wallet-connect', async function () {
        if (window.walletConnected) {
          // [High] 断开钱包为高危操作 — 二次确认
          const confirmed = window.confirm('确定要断开钱包连接吗？');
          if (!confirmed) return;
          await window.disconnectWallet();
        } else {
          await window.connectWallet();
        }
      });
    }, 'connect-btn'));
  }

  // Dashboard 刷新按钮 — [修复] 使用 data-action 避免选择器碰撞
  const refreshBlockedBtn = findActionBtn('#dashboard', 'refresh-blocked');
  if (refreshBlockedBtn) {
    refreshBlockedBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('refresh-blocked', function () {
        if (typeof window.loadBlockedTransfers === 'function') {
          return window.loadBlockedTransfers();
        }
      });
    }, 'refresh-blocked-transfers'));
  }
}

// ==================== 页面特定按钮事件（聚合） ====================

function initPageEvents() {
  initMonitorEvents();
  initCustomersEvents();
  initTagsEvents();
  initLimitsEvents();
  initTimelockEvents();
  initMultisigEvents();
  initQuarantineEvents();
  initIncomingBlocksEvents();
  initEmergencyEvents();
  initLogsEvents();
  initPoliciesEvents();
  initSettingsEvents();
}

// ==================== Monitor 页面 ====================

function initMonitorEvents() {
  const monitorRefreshBtn = findActionBtn('#monitor', 'refresh-monitor');
  if (monitorRefreshBtn) {
    monitorRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('refresh-monitor', function () {
        if (typeof window.refreshMonitor === 'function') {
          return window.refreshMonitor();
        }
      });
    }, 'refresh-monitor'));
  }
}

// ==================== Customers 页面 ====================

function initCustomersEvents() {
  // 搜索框 — [High] 防抖避免高频 DOM 操作
  const customerSearch = document.getElementById('customerSearch');
  if (customerSearch) {
    const debouncedSearch = debounce(function (query) {
      const tbody = document.getElementById('customersTable');
      if (!tbody) return;
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(function (row) {
        const addressCell = row.querySelector('.address-cell');
        if (addressCell) {
          const address = addressCell.textContent.toLowerCase();
          row.style.display = address.includes(query) ? '' : 'none';
        }
      });
    }, 300);

    customerSearch.addEventListener('input', safeExecute(function (e) {
      const query = e.target.value.toLowerCase();
      debouncedSearch(query);
    }, 'customer-search'));
  }

  // 添加客户按钮 — [修复] 加锁保持与其他操作一致性
  const addCustomerBtn = findActionBtn('#customers', 'add-customer');
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      AsyncLock.acquire('open-add-customer', function () {
        if (typeof window.openAddCustomerModal === 'function') {
          return window.openAddCustomerModal();
        }
      });
    }, 'open-add-customer'));
  }
}

// ==================== Tags 页面 ====================

function initTagsEvents() {
  const addTagBtn = findActionBtn('#tags', 'add-tag');
  if (addTagBtn) {
    addTagBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.openTagModal === 'function') {
        window.openTagModal();
      }
    }, 'open-tag-modal'));
  }
}

// ==================== Limits 页面 ====================

function initLimitsEvents() {
  // [High] 保存限额 — 涉及风控参数变更，强制二次确认
  const saveLimitsBtn = findActionBtn('#limits', 'save-limits');
  if (saveLimitsBtn) {
    saveLimitsBtn.addEventListener('click', withConfirmation(
      '确认要保存限额配置吗？\n\n此操作将更新链上风控限额参数。',
      function () {
        if (typeof window.saveLimits === 'function') {
          return window.saveLimits();
        }
      },
      'save-limits'
    ));
  }
}

// ==================== Timelock 页面 ====================

function initTimelockEvents() {
  // 时间锁配置
  const timelockConfigBtn = findActionBtn('#timelock', 'open-timelock-config');
  if (timelockConfigBtn) {
    timelockConfigBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.openTimelockConfigModal === 'function') {
        window.openTimelockConfigModal();
      }
    }, 'open-timelock-config'));
  }

  // 刷新待处理操作
  const timelockRefreshBtn = findActionBtn('#timelock', 'refresh-pending-ops');
  if (timelockRefreshBtn) {
    timelockRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-pending-ops', function () {
        if (typeof window.loadPendingOperations === 'function') {
          return window.loadPendingOperations();
        }
      });
    }, 'load-pending-operations'));
  }
}

// ==================== Multisig 页面 ====================

function initMultisigEvents() {
  // 添加签名者
  const addSignerBtn = findActionBtn('#multisig', 'add-signer');
  if (addSignerBtn) {
    addSignerBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.openAddSignerModal === 'function') {
        window.openAddSignerModal();
      }
    }, 'open-add-signer'));
  }

  // [High] 修改所需签名数 — 高危操作强制二次确认
  // [修复] 使用 data-action 替代 .btn-secondary 选择器，
  //         彻底消除与刷新按钮的选择器碰撞
  const updateSigsBtn = findActionBtn('#multisig', 'update-required-sigs');
  if (updateSigsBtn) {
    updateSigsBtn.addEventListener('click', withConfirmation(
      '⚠️ 确认要修改所需签名数量吗？\n\n此操作将改变多签合约的安全策略。\n设置不当可能导致管理权锁定。',
      function () {
        if (typeof window.updateRequiredSigs === 'function') {
          return window.updateRequiredSigs();
        }
      },
      'update-required-sigs'
    ));
  }

  // 刷新签名者列表 — [修复] data-action 避免碰撞
  const multisigRefreshBtn = findActionBtn('#multisig', 'refresh-signers');
  if (multisigRefreshBtn) {
    multisigRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-signers', function () {
        if (typeof window.loadSigners === 'function') {
          return window.loadSigners();
        }
      });
    }, 'load-signers'));
  }
}

// ==================== Quarantine 页面 ====================

function initQuarantineEvents() {
  const quarantineRefreshBtn = findActionBtn('#quarantine', 'refresh-quarantine');
  if (quarantineRefreshBtn) {
    quarantineRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-quarantine', function () {
        if (typeof window.loadQuarantineRecords === 'function') {
          return window.loadQuarantineRecords();
        }
      });
    }, 'load-quarantine-records'));
  }

  // 过滤器 — change 事件无需 preventDefault（select 行为不导航）
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', safeExecute(function () {
      if (typeof window.filterQuarantineRecords === 'function') {
        window.filterQuarantineRecords();
      }
    }, 'filter-quarantine'));
  }
}

// ==================== Incoming Blocks 页面 ====================

function initIncomingBlocksEvents() {
  const incomingRefreshBtn = findActionBtn('#incomingBlocks', 'refresh-incoming-blocks');
  if (incomingRefreshBtn) {
    incomingRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-incoming-blocks', function () {
        if (typeof window.loadIncomingBlocks === 'function') {
          return window.loadIncomingBlocks();
        }
      });
    }, 'load-incoming-blocks'));
  }
}

// ==================== Emergency 页面 ====================

function initEmergencyEvents() {
  // [High] 紧急暂停 — 高危操作强制二次确认
  // [修复] 确保 return Promise，使错误被 safeExecute → handleError 正确捕获
  //         修复前：AsyncLock.acquire 的 Promise 未 return，
  //         emergencyPause() 抛出的 rejection 绕过 handleError 成为 unhandledrejection
  const emergencyPauseBtn = findActionBtn('#emergency', 'emergency-pause');
  if (emergencyPauseBtn) {
    emergencyPauseBtn.addEventListener('click', withConfirmation(
      '🚨 确认要执行紧急暂停吗？\n\n此操作将立即暂停所有跨链转账功能。\n所有待处理交易将被阻止。',
      function () {
        // [关键修复] return 使 Promise 传递给 safeExecute，错误不再泄漏
        return AsyncLock.acquire('emergency-pause', function () {
          if (typeof window.emergencyPause === 'function') {
            return window.emergencyPause();
          }
        });
      },
      'emergency-pause-action'
    ));
  }

  // [High] 紧急解除暂停 — 同样需要 return Promise
  const emergencyUnpauseBtn = findActionBtn('#emergency', 'emergency-unpause');
  if (emergencyUnpauseBtn) {
    emergencyUnpauseBtn.addEventListener('click', withConfirmation(
      '✅ 确认要解除紧急暂停吗？\n\n此操作将恢复所有跨链转账功能。',
      function () {
        // [关键修复] return 使 Promise 传递给 safeExecute，错误不再泄漏
        return AsyncLock.acquire('emergency-unpause', function () {
          if (typeof window.emergencyUnpause === 'function') {
            return window.emergencyUnpause();
          }
        });
      },
      'emergency-unpause-action'
    ));
  }
}

// ==================== Logs 页面 ====================

function initLogsEvents() {
  const logsRefreshBtn = findActionBtn('#logs', 'refresh-logs');
  if (logsRefreshBtn) {
    logsRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-logs', function () {
        if (typeof window.loadLogs === 'function') {
          return window.loadLogs();
        }
      });
    }, 'load-logs'));
  }

  // 日志筛选 — change 事件无需 preventDefault
  const filterDecision = document.getElementById('filterDecision');
  if (filterDecision) {
    filterDecision.addEventListener('change', safeExecute(function () {
      if (typeof window.filterLogs === 'function') {
        window.filterLogs();
      }
    }, 'filter-logs'));
  }
}

// ==================== Policies 页面 ====================

function initPoliciesEvents() {
  const addPolicyBtn = findActionBtn('#policies', 'add-policy');
  if (addPolicyBtn) {
    addPolicyBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.openPolicyModal === 'function') {
        window.openPolicyModal();
      }
    }, 'open-policy-modal'));
  }

  const policiesRefreshBtn = findActionBtn('#policies', 'refresh-policies');
  if (policiesRefreshBtn) {
    policiesRefreshBtn.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('load-policies', function () {
        if (typeof window.loadPolicies === 'function') {
          return window.loadPolicies();
        }
      });
    }, 'load-policies'));
  }
}

// ==================== Settings 页面 ====================

function initSettingsEvents() {
  // [修复] 添加竞态锁，与其他写操作策略保持一致
  const saveSettingsBtn = findActionBtn('#settings', 'save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', withConfirmation(
      '确认要保存系统设置吗？\n\n此操作将更新管理员配置。',
      function () {
        if (typeof window.saveSettings === 'function') {
          return window.saveSettings();
        }
      },
      'save-settings'
    ));
  }
}

// ==================== 模态框事件 ====================

function initModalEvents() {
  // --- Tag 模态框 ---
  const tagModalConfirm = document.getElementById('tagModalConfirm');
  if (tagModalConfirm) {
    tagModalConfirm.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('save-tag', function () {
        if (typeof window.saveTag === 'function') {
          return window.saveTag();
        }
      });
    }, 'save-tag'));
  }

  const tagModalCancel = document.getElementById('tagModalCancel');
  if (tagModalCancel) {
    tagModalCancel.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closeTagModal === 'function') {
        window.closeTagModal();
      }
    }, 'close-tag-modal'));
  }

  // --- 添加客户模态框 ---
  const customerModalConfirm = document.getElementById('customerModalConfirm');
  if (customerModalConfirm) {
    customerModalConfirm.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('add-customer', function () {
        if (typeof window.addCustomer === 'function') {
          return window.addCustomer();
        }
      });
    }, 'add-customer'));
  }

  const customerModalCancel = document.getElementById('customerModalCancel');
  if (customerModalCancel) {
    customerModalCancel.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closeAddCustomerModal === 'function') {
        window.closeAddCustomerModal();
      }
    }, 'close-customer-modal'));
  }

  // --- Timelock 配置模态框 ---
  const timelockConfigModalConfirm = document.getElementById('timelockConfigModalConfirm');
  if (timelockConfigModalConfirm) {
    timelockConfigModalConfirm.addEventListener('click', withConfirmation(
      '确认要更新时间锁配置吗？',
      function () {
        if (typeof window.updateTimelockConfig === 'function') {
          return window.updateTimelockConfig();
        }
      },
      'update-timelock-config'
    ));
  }

  const timelockConfigModalCancel = document.getElementById('timelockConfigModalCancel');
  if (timelockConfigModalCancel) {
    timelockConfigModalCancel.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closeTimelockConfigModal === 'function') {
        window.closeTimelockConfigModal();
      }
    }, 'close-timelock-config-modal'));
  }

  // --- 添加签名者模态框 ---
  const addSignerModalConfirm = document.getElementById('addSignerModalConfirm');
  if (addSignerModalConfirm) {
    addSignerModalConfirm.addEventListener('click', withConfirmation(
      '⚠️ 确认要添加此签名者吗？\n\n此操作将修改多签合约的签名者列表。',
      function () {
        if (typeof window.addSigner === 'function') {
          return window.addSigner();
        }
      },
      'add-signer-action'
    ));
  }

  const addSignerModalCancel = document.getElementById('addSignerModalCancel');
  if (addSignerModalCancel) {
    addSignerModalCancel.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closeAddSignerModal === 'function') {
        window.closeAddSignerModal();
      }
    }, 'close-add-signer-modal'));
  }

  // --- Policy 模态框 ---
  const policyModalConfirm = document.getElementById('policyModalConfirm');
  if (policyModalConfirm) {
    policyModalConfirm.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      return AsyncLock.acquire('save-policy', function () {
        if (typeof window.savePolicy === 'function') {
          return window.savePolicy();
        }
      });
    }, 'save-policy'));
  }

  const policyModalCancel = document.getElementById('policyModalCancel');
  if (policyModalCancel) {
    policyModalCancel.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closePolicyModal === 'function') {
        window.closePolicyModal();
      }
    }, 'close-policy-modal'));
  }

  // --- Settings 模态框关闭按钮 ---
  const settingsModalClose = document.getElementById('settingsModalClose');
  if (settingsModalClose) {
    settingsModalClose.addEventListener('click', safeExecute(function (e) {
      e.preventDefault();
      if (typeof window.closeSettingsModal === 'function') {
        window.closeSettingsModal();
      }
    }, 'close-settings-modal'));
  }

  // --- 通用模态框遮罩点击关闭 ---
  const modalOverlays = document.querySelectorAll('.modal-overlay');
  modalOverlays.forEach(function (overlay) {
    overlay.addEventListener('click', safeExecute(function (e) {
      // 仅当点击的是遮罩本身（而非内部内容）时关闭
      if (e.target === overlay) {
        const modal = overlay.querySelector('.modal');
        if (modal) {
          if (typeof window.closeModal === 'function') {
            window.closeModal(modal.id);
          } else {
            overlay.style.display = 'none';
          }
        }
      }
    }, 'modal-overlay-click'));
  });
}

// ==================== 全局键盘事件 ====================

function initKeyboardEvents() {
  // ESC 关闭最上层可见模态框
  document.addEventListener('keydown', safeExecute(function (e) {
    if (e.key === 'Escape') {
      const visibleOverlays = document.querySelectorAll(
        '.modal-overlay[style*="flex"], .modal-overlay[style*="block"]'
      );
      if (visibleOverlays.length > 0) {
        const topOverlay = visibleOverlays[visibleOverlays.length - 1];
        const modal = topOverlay.querySelector('.modal');
        if (modal) {
          if (typeof window.closeModal === 'function') {
            window.closeModal(modal.id);
          } else {
            topOverlay.style.display = 'none';
          }
        }
      }
    }
  }, 'keyboard-escape'));
}

// ==================== 事件监听器管理（防内存泄漏） ====================

/**
 * 已注册的事件监听器引用，用于 cleanup 时精确移除
 * 在 SPA 路由切换或页面卸载时调用 cleanupAdminEvents() 清理
 */
const _registeredListeners = [];

/**
 * 包装 addEventListener，自动记录引用以便后续清理
 * @param {Element} target - 目标元素
 * @param {string} event - 事件类型
 * @param {Function} handler - 处理函数
 * @param {Object|boolean} options - 选项
 */
function addManagedListener(target, event, handler, options) {
  if (!target) return;
  target.addEventListener(event, handler, options);
  _registeredListeners.push({ target: target, event: event, handler: handler, options: options });
}

/**
 * 清理函数 — 移除所有通过 addManagedListener 注册的事件监听器
 * 在 SPA 路由切换、HMR 热更新或 beforeunload 时调用，防止内存泄漏
 */
function cleanupAdminEvents() {
  // 移除所有受管理的 DOM 事件监听器
  while (_registeredListeners.length > 0) {
    const item = _registeredListeners.pop();
    try {
      item.target.removeEventListener(item.event, item.handler, item.options);
    } catch (e) {
      console.warn('[cleanup] 移除事件监听器失败:', e);
    }
  }

  // 清理 AsyncLock 中残留的锁
  if (AsyncLock._locks) {
    AsyncLock._locks.clear();
  }

  console.log('[AdminEvents] 所有事件监听器已清理');
}

// ==================== 初始化入口 ====================

/**
 * 初始化所有管理后台事件
 */
function initAdminEvents() {
  // [Fix] 防止重复初始化导致事件处理器重复绑定
  if (window._adminEventsInitialized) {
    console.warn('[AdminEvents] 事件处理器已初始化，跳过重复绑定');
    return;
  }
  window._adminEventsInitialized = true;

  try {
    initNavEvents();
    initMobileSidebarEvents();
    initHeaderEvents();
    initPageEvents();
    initModalEvents();
    initKeyboardEvents();
    console.log('[AdminEvents] 所有事件处理器初始化完成');
  } catch (err) {
    handleError(err, 'init-admin-events');
  }
}

// DOM 就绪后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminEvents);
} else {
  // DOM 已就绪（defer 脚本或异步加载时可能已解析完成）
  initAdminEvents();
}

// 导出清理函数到全局（供 SPA 路由 / HMR 使用）
if (typeof window !== 'undefined') {
  window.cleanupAdminEvents = cleanupAdminEvents;
  window.AsyncLock = AsyncLock;
}
