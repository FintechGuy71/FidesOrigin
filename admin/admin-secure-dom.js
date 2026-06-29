// FidesOrigin Admin - Secure DOM Operations Module
// Replaces all innerHTML with safe DOM API (createElement/textContent)
// No eval(), no new Function(), no innerHTML

// ==================== 安全 DOM 工具函数 ====================

/**
 * 安全创建文本节点
 */
function createText(text) {
  return document.createTextNode(text);
}

/**
 * 安全创建元素，设置文本内容（自动转义HTML）
 */
function createEl(tag, options = {}) {
  const el = document.createElement(tag);
  
  if (options.text !== undefined) {
    el.textContent = String(options.text);
  }
  if (options.className) {
    el.className = options.className;
  }
  if (options.id) {
    el.id = options.id;
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, val]) => {
      el.setAttribute(key, val);
    });
  }
  if (options.styles) {
    Object.entries(options.styles).forEach(([key, val]) => {
      el.style[key] = val;
    });
  }
  if (options.children) {
    options.children.forEach(child => {
      if (child instanceof Node) {
        el.appendChild(child);
      } else if (typeof child === 'string') {
        el.appendChild(createText(child));
      }
    });
  }
  
  return el;
}

/**
 * 安全清空元素内容
 */
function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * 安全设置表格加载状态
 */
function setTableLoading(tbody, colSpan, message) {
  clearElement(tbody);
  const tr = createEl('tr');
  const td = createEl('td', {
    className: 'table-loading',
    attrs: { colspan: String(colSpan) }
  });
  const spinner = createEl('div', { className: 'spinner' });
  const msg = createEl('div', { text: message });
  td.appendChild(spinner);
  td.appendChild(msg);
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/**
 * 安全创建标签元素
 */
function createTag(text, tagClass) {
  const tagMap = {
    'vip': 'tag-vip',
    'normal': 'tag-normal',
    'grey': 'tag-grey',
    'black': 'tag-black',
    'admin': 'tag-admin',
    'operator': 'tag-operator',
    'success': 'tag-success'
  };
  const cls = tagMap[tagClass] || 'tag-grey';
  return createEl('span', {
    className: `tag ${cls}`,
    text: text
  });
}

/**
 * 安全创建按钮（无内联onclick）
 */
function createButton(text, btnClass, dataAction, dataId) {
  const btn = createEl('button', {
    className: `btn btn-sm ${btnClass}`,
    text: text
  });
  if (dataAction) btn.setAttribute('data-action', dataAction);
  if (dataId) btn.setAttribute('data-id', dataId);
  return btn;
}

/**
 * 安全创建表格行单元格
 */
function createCell(text, className) {
  const opts = {};
  if (className) opts.className = className;
  if (text !== undefined) opts.text = text;
  return createEl('td', opts);
}

// ==================== 安全表格渲染 ====================

/**
 * 安全渲染拦截记录表格
 */
function renderBlockedTable(data) {
  const tbody = document.getElementById('blockedTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    setTableLoading(tbody, 5, '暂无数据');
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.time));
    tr.appendChild(createCell(row.address, 'address-cell'));
    
    const tagClass = row.tag === '黑名单' ? 'black' : 'grey';
    const tagCell = createEl('td');
    tagCell.appendChild(createTag(row.tag, tagClass));
    tr.appendChild(tagCell);
    
    tr.appendChild(createCell(row.reason));
    tr.appendChild(createCell(row.amount));
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染监控表格
 */
function renderMonitorTable(data) {
  const tbody = document.getElementById('monitorTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    setTableLoading(tbody, 6, '暂无数据');
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.id));
    tr.appendChild(createCell(row.hash, 'address-cell'));
    tr.appendChild(createCell(row.from, 'address-cell'));
    tr.appendChild(createCell(row.to, 'address-cell'));
    tr.appendChild(createCell(row.amount));
    
    const statusClass = row.status === '已拦截' ? 'black' : 
                        row.status === '已通过' ? 'normal' : 'grey';
    const statusCell = createEl('td');
    statusCell.appendChild(createTag(row.status, statusClass));
    tr.appendChild(statusCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染客户表格
 */
function renderCustomersTable(data) {
  const tbody = document.getElementById('customersTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    setTableLoading(tbody, 6, '暂无数据');
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.address, 'address-cell'));
    
    const riskCell = createEl('td');
    const riskSpan = createEl('span', {
      text: `${row.risk} - ${getRiskLabel(row.risk)}`,
      styles: { color: getRiskColor(row.risk) }
    });
    riskCell.appendChild(riskSpan);
    tr.appendChild(riskCell);
    
    tr.appendChild(createCell(formatCurrency(row.daily)));
    tr.appendChild(createCell(formatCurrency(row.used)));
    tr.appendChild(createCell(formatCurrency(row.balance)));
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('查看', 'btn-secondary', 'view-customer', row.address));
    actionCell.appendChild(document.createTextNode(' '));
    actionCell.appendChild(createButton('编辑', 'btn-primary', 'edit-customer', row.address));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染标签表格
 */
function renderTagsTable(data) {
  const tbody = document.getElementById('tagsTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '5' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.address, 'address-cell'));
    
    const tagCell = createEl('td');
    tagCell.appendChild(createTag(row.tag, row.tag.toLowerCase()));
    tr.appendChild(tagCell);
    
    tr.appendChild(createCell(row.reason));
    tr.appendChild(createCell(row.operator));
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('编辑', 'btn-secondary', 'edit-tag', row.address));
    actionCell.appendChild(document.createTextNode(' '));
    actionCell.appendChild(createButton('删除', 'btn-danger', 'remove-tag', row.address));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染时间锁操作表格
 */
function renderTimelockTable(data) {
  const tbody = document.getElementById('pendingOpsTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '6' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(op => {
    const tr = createEl('tr');
    tr.appendChild(createCell(op.id));
    tr.appendChild(createCell(op.type));
    tr.appendChild(createCell(op.target, 'address-cell'));
    tr.appendChild(createCell(op.scheduled));
    
    const statusCell = createEl('td');
    statusCell.appendChild(createTag(op.status, 'grey'));
    tr.appendChild(statusCell);
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('取消', 'btn-danger', 'cancel-op', op.id));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染签名者表格
 */
function renderSignersTable(data) {
  const tbody = document.getElementById('signersTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '4' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(s => {
    const tr = createEl('tr');
    tr.appendChild(createCell(s.address, 'address-cell'));
    
    const roleCell = createEl('td');
    roleCell.appendChild(createTag(s.role, s.role === 'Owner' ? 'admin' : 'operator'));
    tr.appendChild(roleCell);
    
    const statusCell = createEl('td');
    statusCell.appendChild(createTag(s.status, s.status === '已确认' ? 'normal' : 'grey'));
    tr.appendChild(statusCell);
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('查看', 'btn-secondary', 'view-signer', s.address));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染隔离资金表格
 */
function renderQuarantineTable(data) {
  const tbody = document.getElementById('quarantineTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '8' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(h => {
    const tr = createEl('tr');
    tr.appendChild(createCell(h.id));
    tr.appendChild(createCell(h.address, 'address-cell'));
    tr.appendChild(createCell(h.token || 'TUSD'));
    tr.appendChild(createCell(h.amount));
    tr.appendChild(createCell(h.heldSince));
    tr.appendChild(createCell(h.reason));
    tr.appendChild(createCell(h.status || '待处理'));
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('释放', 'btn-success', 'release-quarantine', h.id));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染合规日志表格
 */
function renderComplianceLogs(data) {
  const tbody = document.getElementById('complianceLogsTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    setTableLoading(tbody, 6, '暂无数据');
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.from, 'address-cell'));
    tr.appendChild(createCell(row.to, 'address-cell'));
    tr.appendChild(createCell(row.amount));
    
    const decisionClass = row.decision === 'ALLOW' ? 'normal' :
                          row.decision === 'BLOCK' ? 'black' :
                          row.decision === 'HOLD' ? 'grey' : 'grey';
    const decisionCell = createEl('td');
    decisionCell.appendChild(createTag(row.decision, decisionClass));
    tr.appendChild(decisionCell);
    
    tr.appendChild(createCell(row.reason));
    tr.appendChild(createCell(row.time));
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染策略历史表格
 */
function renderPolicyHistory(data) {
  const tbody = document.getElementById('policyHistoryTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '7' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.version));
    tr.appendChild(createCell(formatNumber(row.maxTx)));
    tr.appendChild(createCell(formatNumber(row.dailyLimit)));
    tr.appendChild(createCell(row.allowMedium ? '是' : '否'));
    tr.appendChild(createCell(row.allowHigh ? '是' : '否'));
    tr.appendChild(createCell(row.updatedAt));
    
    const actionCell = createEl('td');
    actionCell.appendChild(createButton('查看', 'btn-secondary', 'view-policy', row.version));
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

/**
 * 安全渲染收款拦截表格
 */
function renderIncomingBlocks(data) {
  const tbody = document.getElementById('incomingBlocksTable');
  clearElement(tbody);
  
  if (!data || data.length === 0) {
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '6' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  data.forEach(row => {
    const tr = createEl('tr');
    tr.appendChild(createCell(row.time));
    tr.appendChild(createCell(row.from, 'address-cell'));
    tr.appendChild(createCell(row.to, 'address-cell'));
    tr.appendChild(createCell(row.amount));
    tr.appendChild(createCell(row.reason));
    tr.appendChild(createCell(row.hash, 'address-cell'));
    tbody.appendChild(tr);
  });
}

// ==================== 委托事件处理 ====================

/**
 * 初始化所有表格按钮的委托事件监听
 * 替代内联 onclick
 */
function initDelegatedEvents() {
  // 客户表格按钮
  const customersTable = document.getElementById('customersTable');
  if (customersTable) {
    customersTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'view-customer') viewCustomer(id);
      if (action === 'edit-customer') editCustomer(id);
    });
  }
  
  // 标签表格按钮
  const tagsTable = document.getElementById('tagsTable');
  if (tagsTable) {
    tagsTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'edit-tag') editTag(id);
      if (action === 'remove-tag') removeTag(id);
    });
  }
  
  // 时间锁表格按钮
  const pendingOpsTable = document.getElementById('pendingOpsTable');
  if (pendingOpsTable) {
    pendingOpsTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'cancel-op') cancelOperation(id);
    });
  }
  
  // 签名者表格按钮
  const signersTable = document.getElementById('signersTable');
  if (signersTable) {
    signersTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'view-signer') showToast('查看签名者: ' + id, 'info');
    });
  }
  
  // 隔离表格按钮
  const quarantineTable = document.getElementById('quarantineTable');
  if (quarantineTable) {
    quarantineTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'release-quarantine') releaseFunds(id);
    });
  }
  
  // 策略历史表格按钮
  const policyHistoryTable = document.getElementById('policyHistoryTable');
  if (policyHistoryTable) {
    policyHistoryTable.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'view-policy') showToast('查看策略: ' + id, 'info');
    });
  }
}

// ==================== 安全确认对话框 ====================

/**
 * 安全确认对话框（替代原生 confirm）
 */
function safeConfirm(message, onConfirm, onCancel) {
  // 使用自定义模态框替代 confirm
  const modal = document.getElementById('confirmModal');
  if (modal) {
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.add('active');
    
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    
    const handleConfirm = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };
    
    const handleCancel = () => {
      cleanup();
      if (onCancel) onCancel();
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  } else {
    // 降级到原生 confirm（仅在无模态框时）
    if (window.confirm(message)) {
      if (onConfirm) onConfirm();
    } else {
      if (onCancel) onCancel();
    }
  }
}

// ==================== 导出 ====================
if (typeof window !== 'undefined') {
  window.createEl = createEl;
  window.clearElement = clearElement;
  window.setTableLoading = setTableLoading;
  window.createTag = createTag;
  window.createButton = createButton;
  window.createCell = createCell;
  window.renderBlockedTable = renderBlockedTable;
  window.renderMonitorTable = renderMonitorTable;
  window.renderCustomersTable = renderCustomersTable;
  window.renderTagsTable = renderTagsTable;
  window.renderTimelockTable = renderTimelockTable;
  window.renderSignersTable = renderSignersTable;
  window.renderQuarantineTable = renderQuarantineTable;
  window.renderComplianceLogs = renderComplianceLogs;
  window.renderPolicyHistory = renderPolicyHistory;
  window.renderIncomingBlocks = renderIncomingBlocks;
  window.initDelegatedEvents = initDelegatedEvents;
  window.safeConfirm = safeConfirm;
}
