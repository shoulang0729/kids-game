// Keep bookmarks to the former all-games manual pointing at the right page.
function openLegacyManual() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); }
  catch { return; }
  const link = document.getElementById(id);
  if (link?.matches("a[data-manual]")) location.replace(link.href);
}
window.addEventListener("hashchange", openLegacyManual);
openLegacyManual();
