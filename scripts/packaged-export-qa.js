(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clickText = (text) => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => (item.textContent || '').includes(text) || (item.title || '').includes(text));
    if (!button) throw new Error(`Button not found: ${text}`);
    button.click();
  };
  const setInput = (selector, index, value) => {
    const input = Array.from(document.querySelectorAll(selector))[index];
    if (!input) throw new Error(`Input not found: ${selector}[${index}]`);
    const setter = Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  await wait(1200);
  if (!window.desktopAPI) throw new Error('desktopAPI missing in packaged app');
  clickText('دراسة جديدة');
  await wait(200);
  setInput('.wizard input', 0, 'Packaged Export QA');
  setInput('.wizard input', 1, 'Al Malqa');
  setInput('.wizard input', 2, 'QA');
  clickText('Next');
  await wait(100);
  clickText('Continue');
  await wait(100);
  clickText('Next');
  await wait(100);
  setInput('.wizard select', 0, 'RIYADH-M111');
  clickText('Next');
  await wait(100);
  clickText('Create Study');
  await wait(500);
  clickText('Reports');
  await wait(300);
  clickText('Export Excel');
  await wait(1000);
  clickText('Export PDF');
  await wait(1000);
  const state = await window.desktopAPI.loadState();
  const text = document.body.textContent || '';
  return {
    desktopAPI: true,
    projects: state.projects.length,
    activeProject: state.projects[0]?.info?.name,
    excelVisible: text.includes('XLSX exported'),
    pdfVisible: text.includes('PDF exported'),
    text: text.slice(0, 500)
  };
})();
