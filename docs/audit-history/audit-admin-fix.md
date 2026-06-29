admin/admin-events.js | 27 +++++++++++++++++++++++++++
 admin/admin.js        | 16 ++++++++++++++--
 2 files changed, 41 insertions(+), 2 deletions(-)

diff --git a/admin/admin-events.js b/admin/admin-events.js
index d9d0c35d..e92928f1 100644
--- a/admin/admin-events.js
+++ b/admin/admin-events.js
@@ -78,6 +78,24 @@ function initPageEvents() {
     });
   }
   
+  // Customers page search
+  const customerSearch = document.getElementById('customerSearch');
+  if (customerSearch) {
+    customerSearch.addEventListener('input', function(e) {
+      const query = e.target.value.toLowerCase();
+      const tbody = document.getElementById('customersTable');
+      if (!tbody) return;
+      const rows = tbody.querySelectorAll('tr');
+      rows.forEach(row => {
+        const addressCell = row.querySelector('.address-cell');
+        if (addressCell) {
+          const address = addressCell.textContent.toLowerCase();
+          row.style.display = address.includes(query) ? '' : 'none';
+        }
+      });
+    });
+  }
+  
   // Customers page add button
   const addCustomerBtn = document.querySelector('#customers .btn-primary');
   if (addCustomerBtn) {
@@ -132,6 +150,15 @@ function initPageEvents() {
     });
   }
   
+  // Multisig page update required sigs button (the one next to input)
+  const updateSigsBtn = document.querySelector('#requiredSigs')?.closest('.form-group')?.querySelector('.btn-secondary');
+  if (updateSigsBtn) {
+    updateSigsBtn.addEventListener('click', function(e) {
+      e.preventDefault();
+      updateRequiredSigs();
+    });
+  }
+  
   // Multisig page refresh button
   const multisigRefreshBtn = document.querySelector('#multisig .btn-secondary');
   if (multisigRefreshBtn) {

diff --git a/admin/admin.js b/admin/admin.js
index 16aca1ab..c0b1c1e8 100644
--- a/admin/admin.js
+++ b/admin/admin.js
@@ -39,7 +39,7 @@ function formatDate(dateString) {
 function formatDate(dateString) {
   if (!dateString) return '--';
   const date = new Date(dateString);
-  return date.toLocaleString('zh-CN');;
+  return date.toLocaleString('zh-CN');
 }
 
 function getRiskColor(score) {
@@ -142,7 +142,8 @@ async function connectWallet() {
       
       // 获取网络信息
       const network = await provider.getNetwork();
-      const networkName = CONFIG.networks[network.chainId] || '未知网络';
+      const networkConfig = Object.values(CONFIG.networks).find(n => n.chainId === Number(network.chainId));
+      const networkName = networkConfig ? networkConfig.name : '未知网络';
       if (networkBadge) networkBadge.textContent = networkName;
       
       showToast('钱包成功', 'success');
@@ -187,7 +188,18 @@ async function disconnectWallet() {
 }
 
 // ==================== 图表初始化 ====================
+function destroyCharts() {
+  Object.values(charts).forEach(chart => {
+    if (chart && typeof chart.destroy === 'function') {
+      chart.destroy();
+    }
+  });
+  charts = {};
+}
+
 function initCharts() {
+  // 先销毁旧图表防止内存泄漏
+  destroyCharts();
   // 风险分布饼图
   const riskCtx = document.getElementById('riskChart');
   if (riskCtx) {