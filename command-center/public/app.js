import { api, setUnauthorizedHandler } from './api.js';
import { renderLogin, renderBoard } from './board.js';
import { openDrawer } from './drawer.js';

const root = document.getElementById('app');
let boardHandle = null;

async function showBoard() {
  boardHandle = await renderBoard(root, {
    onOpenDeal: id => openDrawer(id, { onChanged: () => boardHandle?.reload() }),
    onLogout: showLogin,
  });
}

function showLogin() {
  renderLogin(root, { onSuccess: showBoard });
}

setUnauthorizedHandler(showLogin);

(async function start() {
  try {
    const session = await api.session();
    if (session.authenticated) showBoard();
    else showLogin();
  } catch {
    showLogin();
  }
})();
