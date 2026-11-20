// Recovery codes exist only in this page's memory/DOM and the user's download.
export function displayRecoveryCodes(section, codes) {
  const list = section.querySelector('[data-code-list]');
  list.replaceChildren();
  for (const code of codes) {
    const item = document.createElement('li');
    const text = document.createElement('code');
    text.textContent = code.match(/.{5}/g).join('-');
    item.append(text); list.append(item);
  }
  const ack = section.querySelector('[data-code-ack]');
  const next = section.querySelector('[data-code-continue]');
  ack.checked = false; next.disabled = true;
  ack.addEventListener('change', () => { next.disabled = !ack.checked; });
  section.querySelector('[data-code-download]').addEventListener('click', () => {
    const text = 'Commencely recovery codes\nKeep private, separate from your password. Each works once.\nReplacing codes invalidates all previous codes.\n\n' +
      codes.map(code => code.match(/.{5}/g).join('-')).join('\n') +
      '\n\nWithout your authenticator or unused recovery codes, account access cannot be restored by email alone.\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'Commencely-recovery-codes.txt';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  next.addEventListener('click', () => { if (ack.checked) location.assign(next.dataset.codeContinue); });
  section.hidden = false;
}
