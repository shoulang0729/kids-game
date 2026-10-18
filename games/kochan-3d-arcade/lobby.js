const search = document.getElementById("search");
const sections = [...document.querySelectorAll("#games section")];
const cards = [...document.querySelectorAll(".game-card")];
function filterGames() {
  const query = search.value.normalize("NFKC").trim().toLocaleLowerCase();
  let visible = 0;
  for (const card of cards) {
    card.hidden = !card.textContent.normalize("NFKC").toLocaleLowerCase().includes(query);
    if (!card.hidden) visible++;
  }
  for (const section of sections) section.hidden = !section.querySelector(".game-card:not([hidden])");
  document.getElementById("count").textContent = `${visible} / ${cards.length}種類`;
  document.getElementById("empty").hidden = visible !== 0;
}
search.addEventListener("input", filterGames);
// Category links always reveal their destination, including after a search.
document.querySelectorAll("nav a").forEach(link => link.addEventListener("click", () => {
  search.value = "";
  filterGames();
}));
filterGames();
