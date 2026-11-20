document.querySelector('#back-page').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.assign('/');
});
