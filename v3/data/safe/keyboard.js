document.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (meta && e.shiftKey && e.code === 'KeyD') {
    document.getElementById('decrypt').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyE') {
    document.getElementById('encrypt').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyW') {
    document.getElementById('swap').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyS') {
    document.getElementById('store').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyM') {
    document.getElementById('remove').click();
  }
});
