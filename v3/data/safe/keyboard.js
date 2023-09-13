document.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (meta && e.shiftKey && e.code === 'KeyD') {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('decrypt').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyE') {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('encrypt').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyW') {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('swap').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyS') {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('store').click();
  }
  else if (meta && e.shiftKey && e.code === 'KeyM') {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('remove').click();
  }
});
