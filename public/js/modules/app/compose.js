/**
 * 邮件撰写模块
 * @module modules/app/compose
 */

import { escapeHtml } from './ui-helpers.js';
import { getCurrentMailbox } from './mailbox-state.js';

/**
 * 初始化撰写模态框
 * @param {object} elements - DOM 元素
 * @param {Function} api - API 函数
 * @param {Function} showToast - 提示函数
 */
export function initCompose(elements, api, showToast) {
  const { compose, composeModal, composeClose, composeCancel, composeSend, composeTo, composeSubject, composeHtml, composeFromName } = elements;
  
  if (!compose || !composeModal) return;
  
  // 打开撰写模态框
  compose.onclick = () => {
    const mailbox = getCurrentMailbox();
    if (!mailbox) {
      showToast('请先选择或生成一个邮箱', 'warn');
      return;
    }
    
    // 清空表单
    if (composeTo) composeTo.value = '';
    if (composeSubject) composeSubject.value = '';
    if (composeHtml) composeHtml.value = '';
    if (composeFromName) composeFromName.value = '';
    
    composeModal.classList.add('show');
    setTimeout(() => composeTo?.focus(), 100);
  };
  
  // 关闭
  const closeModal = () => {
    composeModal.classList.remove('show');
  };
  
  if (composeClose) composeClose.onclick = closeModal;
  if (composeCancel) composeCancel.onclick = closeModal;
  
  // 发送
  if (composeSend) {
    composeSend.onclick = async () => {
      const mailbox = getCurrentMailbox();
      if (!mailbox) {
        showToast('请先选择发件邮箱', 'warn');
        return;
      }
      
      const to = (composeTo?.value || '').trim();
      const subject = (composeSubject?.value || '').trim();
      const html = (composeHtml?.value || '').trim();
      const fromName = (composeFromName?.value || '').trim();
      
      if (!to) {
        showToast('请输入收件人地址', 'warn');
        return;
      }
      
      if (!subject && !html) {
        showToast('主题和内容不能都为空', 'warn');
        return;
      }
      
      // 设置加载状态
      const originalText = composeSend.textContent;
      composeSend.disabled = true;
      composeSend.innerHTML = '<span class="spinner"></span> 发送中…';
      
      try {
        const body = {
          from: mailbox,
          to,
          subject: subject || '(无主题)',
          html: html || ''
        };
        if (fromName) body.fromName = fromName;
        
        const r = await api('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || '发送失败');
        }
        
        showToast('邮件发送成功！', 'success');
        closeModal();
      } catch (e) {
        showToast(e.message || '发送失败，请稍后重试', 'error');
      } finally {
        composeSend.disabled = false;
        composeSend.textContent = originalText;
      }
    };
  }
}

/**
 * 显示已发送邮件详情
 * @param {object} email - 邮件数据
 * @param {object} elements - DOM 元素
 */
export function showSentEmailDetail(email, elements) {
  const { modal, modalSubject, modalContent } = elements;
  if (!email) return;
  
  const e = email;
  const subjectHtml = `
    <span class="modal-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="/icons/sprites.svg#icon-send"/></svg></span>
    <span>${escapeHtml(e.subject || '(无主题)')}</span>
  `;
  
  const recipients = (e.recipients || e.to_addrs || '').toString();
  const status = e.status || 'unknown';
  
  let statusBadge = '';
  const statusMap = {
    'queued': { class: 'status-queued', text: '排队中' },
    'delivered': { class: 'status-delivered', text: '已送达' },
    'failed': { class: 'status-failed', text: '发送失败' },
    'processing': { class: 'status-processing', text: '处理中' }
  };
  const statusInfo = statusMap[status] || { class: '', text: status };
  statusBadge = `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
  
  const detailHtml = `
    <div class="sent-detail">
      <div class="detail-meta">
        <div class="meta-row"><span class="meta-label">收件人：</span><span class="meta-value">${escapeHtml(recipients)}</span></div>
        <div class="meta-row"><span class="meta-label">状态：</span>${statusBadge}</div>
        <div class="meta-row"><span class="meta-label">发送时间：</span><span class="meta-value">${escapeHtml(e.created_at || '')}</span></div>
      </div>
      <div class="detail-content">
        ${e.html_content ? e.html_content : `<pre>${escapeHtml(e.text_content || '')}</pre>`}
      </div>
    </div>
  `;

  const readingPane = document.getElementById('reading-pane');
  const readingSubject = document.getElementById('reading-subject');
  const readingMeta = document.getElementById('reading-meta');
  const readingContent = document.getElementById('reading-content');
  if (readingPane && readingSubject && readingMeta && readingContent) {
    document.querySelectorAll('.email-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.emailId === String(e.id));
    });
    readingPane.classList.add('has-message');
    readingSubject.textContent = e.subject || '(无主题)';
    readingMeta.innerHTML = `<div class="email-meta-inline"><span>收件人：${escapeHtml(recipients)}</span><span>${statusBadge}</span><span>发送时间：${escapeHtml(e.created_at || '')}</span></div>`;
    readingContent.innerHTML = detailHtml;
    return;
  }

  if (!modal || !modalSubject || !modalContent) return;
  modalSubject.innerHTML = subjectHtml;
  modalContent.innerHTML = detailHtml;
  
  modal.classList.add('show');
}

export default {
  initCompose,
  showSentEmailDetail
};
