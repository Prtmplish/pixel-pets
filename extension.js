const vscode = require('vscode');
const { PetViewProvider, SPECIES, THEMES } = require('./petView');

const EMPTY_SCORE = { wins: 0, losses: 0, draws: 0, streak: 0, best: 0 };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const EMOJI = { rock: '\u{1FAA8}', paper: '\u{1F4C4}', scissors: '✂️' };
const MOVES = Object.keys(BEATS);
const LABEL = { cat: 'Cat', dog: 'Dog', fox: 'Fox', ghost: 'Ghost' };

/** @type {PetViewProvider} */
let pets;
/** @type {vscode.QuickPick<any> | undefined} */
let quickPick;
/** @type {vscode.StatusBarItem | undefined} */
let statusBar;

function activate(context) {
  pets = new PetViewProvider(context);
  pets.onReward = () => renderStatusBar(context);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'pets.play';
  context.subscriptions.push(statusBar);
  renderStatusBar(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pets.view', pets, {
      webviewOptions: { retainContextWhenHidden: true }
    }),

    vscode.commands.registerCommand('pets.throwBall', () => pets.throwBall()),
    vscode.commands.registerCommand('pets.choose', () => choose()),
    vscode.commands.registerCommand('pets.cycleTheme', () => cycleTheme()),
    vscode.commands.registerCommand('pets.play', () => showPicker(context)),
    vscode.commands.registerCommand('pets.resetScore', async () => {
      await context.globalState.update('pets.score', EMPTY_SCORE);
      renderStatusBar(context);
      if (quickPick) quickPick.title = titleFor(EMPTY_SCORE);
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pets')) {
        pets.sync();
        renderStatusBar(context);
      }
    })
  );
}

function config() {
  return vscode.workspace.getConfiguration('pets');
}

function getScore(context) {
  return Object.assign({}, EMPTY_SCORE, context.globalState.get('pets.score', EMPTY_SCORE));
}

function renderStatusBar(context) {
  if (!statusBar) return;
  if (!config().get('showStatusBar', true)) {
    statusBar.hide();
    return;
  }
  const s = getScore(context);
  statusBar.text = '$(game) ' + s.wins + '-' + s.losses + '-' + s.draws;
  statusBar.tooltip = 'Rock paper scissors — ' + s.wins + ' wins, ' + s.losses + ' losses, ' +
    s.draws + ' draws (best streak ' + s.best + ')\n' +
    'Fetches: ' + context.globalState.get('pets.catches', 0) +
    ' · pats: ' + context.globalState.get('pets.pats', 0);
  statusBar.show();
}

async function choose() {
  const pick = await vscode.window.showQuickPick(
    SPECIES.map((key) => ({ label: LABEL[key] || key, key })),
    { title: 'Which pet?', placeHolder: 'It moves into the Explorer.' }
  );
  if (!pick) return;
  await config().update('species', pick.key, vscode.ConfigurationTarget.Global);
}

async function cycleTheme() {
  const current = config().get('theme', 'forest');
  const next = THEMES[(Math.max(0, THEMES.indexOf(current)) + 1) % THEMES.length];
  await config().update('theme', next, vscode.ConfigurationTarget.Global);
}

function titleFor(score, round) {
  const tally = score.wins + '–' + score.losses + '–' + score.draws;
  const streak = score.streak > 1 ? '  ·  streak ' + score.streak : '';
  if (!round) return 'Rock Paper Scissors  ·  ' + tally + streak;
  return EMOJI[round.you] + ' vs ' + EMOJI[round.them] + '  ' + round.verdict +
    '  ·  ' + tally + streak;
}

/** Floating overlay: a quick pick sits on top of the editor, terminal, settings — anything. */
function showPicker(context) {
  if (quickPick) {
    quickPick.show();
    return;
  }

  const qp = vscode.window.createQuickPick();
  quickPick = qp;
  qp.title = titleFor(getScore(context));
  qp.placeholder = 'r / p / s then Enter — Esc to leave';
  qp.matchOnDescription = true;
  qp.items = MOVES.map((move) => ({
    label: EMOJI[move] + '  ' + move.charAt(0).toUpperCase() + move.slice(1),
    description: move.charAt(0),
    move
  }));

  qp.onDidAccept(async () => {
    const pick = /** @type {any} */ (qp.selectedItems[0]);
    if (!pick || !pick.move) return;

    const you = pick.move;
    const them = MOVES[Math.floor(Math.random() * MOVES.length)];
    const score = getScore(context);
    let verdict;

    if (you === them) {
      score.draws += 1;
      verdict = 'Draw.';
    } else if (BEATS[you] === them) {
      score.wins += 1;
      score.streak += 1;
      score.best = Math.max(score.best, score.streak);
      verdict = score.streak > 2 ? 'You win — ' + score.streak + ' in a row!' : 'You win!';
      pets.throwBall();
    } else {
      score.losses += 1;
      score.streak = 0;
      verdict = 'You lose.';
    }

    await context.globalState.update('pets.score', score);
    renderStatusBar(context);

    qp.title = titleFor(score, { you, them, verdict });
    qp.value = '';
  });

  qp.onDidHide(() => {
    qp.dispose();
    quickPick = undefined;
  });

  qp.show();
}

function deactivate() {}

module.exports = { activate, deactivate };
