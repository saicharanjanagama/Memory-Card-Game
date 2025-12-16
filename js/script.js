(() => {

  /* ------------------ THEMES ------------------ */
  const THEMES = {
    emojis: ["😀","😂","😍","🤩","😎","😴","🤖","👻","🎃","🌞","⭐","🍀","🍩","🍪","⚽","🎲","🎧","🚀"],
    animals: ["🐶","🐱","🦊","🐼","🦁","🐯","🐨","🐵","🐸","🐙","🦄","🐷","🐮","🐔","🦉","🦋","🐢","🐝"],
    food: ["🍕","🍔","🍟","🌭","🍿","🥗","🍣","🍜","🍩","🍪","🍰","🍫","🍎","🍉","🍓","🍌","🥭","☕"],
    pokemon: ["⚡","🔥","💧","🌱","🪨","🦴","🦋","🌙","☀️","🍃","❄️","🫧","✨","🌀","🌈","👾","🔮","🦄"]
  };

  /* ------------------ DOM ELEMENTS ------------------ */
  const startScreen = document.getElementById("startScreen");
  const gameScreen  = document.getElementById("gameScreen");

  const themeSelect = document.getElementById("themeSelect");
  const diffSelect  = document.getElementById("difficulty");

  const startBtn = document.getElementById("startGame");
  const backBtn  = document.getElementById("backToMenu");

  const board = document.getElementById("gameBoard");

  const movesEl = document.getElementById("moves");
  const timeEl  = document.getElementById("time");

  const newGameBtn = document.getElementById("newGame");

  const modal = document.getElementById("modal");
  const playAgain = document.getElementById("playAgain");
  const closeModal = document.getElementById("closeModal");

  const resultEl = document.getElementById("result");

  const bestMoves = document.getElementById("bestMoves");
  const bestTime  = document.getElementById("bestTime");
  const bestScore = document.getElementById("bestScore");

  const confettiCanvas = document.getElementById("confetti-canvas");
  const modeToggle = document.getElementById("modeToggle");

  /* ------------------ GAME STATE ------------------ */
  let first = null, second = null, lock = false;
  let moves = 0, seconds = 0, timer = null, matched = 0, totalCards = 0;

  const BEST_KEY = "MEMORY_BEST";
  const DARK_KEY = "MEMORY_DARK";
  const GAME_KEY = "MEMORY_STATE";

  /* ------------------ DARK MODE ------------------ */
  function loadDarkMode() {
    const mode = localStorage.getItem(DARK_KEY);
    if (mode === "dark") {
      document.body.setAttribute("data-theme","dark");
      modeToggle.textContent = "☀️ Light Mode";
    }
  }
  loadDarkMode();

  modeToggle.addEventListener("click", () => {
    if (document.body.hasAttribute("data-theme")) {
      document.body.removeAttribute("data-theme");
      localStorage.setItem(DARK_KEY,"light");
      modeToggle.textContent = "🌙 Dark Mode";
    } else {
      document.body.setAttribute("data-theme","dark");
      localStorage.setItem(DARK_KEY,"dark");
      modeToggle.textContent = "☀️ Light Mode";
    }
  });

  /* ------------------ AUDIO ------------------ */
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const beep = (f, d=0.1) => {
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.value=f; g.gain.value=0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+d);
  };

  const flipSound = ()=>beep(700,0.06);
  const matchSound=()=>beep(1200,0.12);
  const winSound  =()=>{ beep(900); setTimeout(()=>beep(1200),70); setTimeout(()=>beep(1500),140); };

  /* ------------------ CONFETTI ------------------ */
  function confetti() {
    const c = confettiCanvas.getContext("2d");
    confettiCanvas.width = innerWidth;
    confettiCanvas.height = innerHeight;

    let arr=[];
    for(let i=0;i<120;i++){
      arr.push({
        x:Math.random()*innerWidth,
        y:Math.random()*-innerHeight,
        vx:(Math.random()-0.5)*4,
        vy:Math.random()*4+2,
        size:Math.random()*8+4,
        color:`hsl(${Math.random()*360},80%,60%)`
      });
    }

    function frame(){
      c.clearRect(0,0,innerWidth,innerHeight);
      arr.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        c.fillStyle=p.color;
        c.fillRect(p.x,p.y,p.size,p.size);
      });
      arr=arr.filter(p=>p.y<innerHeight+20);
      if(arr.length) requestAnimationFrame(frame);
    }
    frame();
  }

  /* ------------------ BEST SCORE ------------------ */
  function loadBest() {
    const b = JSON.parse(localStorage.getItem(BEST_KEY)||"null");
    if(!b){
      bestMoves.textContent="--";
      bestTime.textContent="--";
      bestScore.textContent="--";
      return;
    }
    bestMoves.textContent = b.moves;
    bestTime.textContent  = formatTime(b.time);
    bestScore.textContent = b.score;
  }

  function saveBest(score) {
    const existing = JSON.parse(localStorage.getItem(BEST_KEY)||"null") || { score:0 };
    if(score > existing.score) {
      localStorage.setItem(BEST_KEY,
        JSON.stringify({ moves, time:seconds, score })
      );
    }
  }

  /* ------------------ TIMER ------------------ */
  function formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  }

  function startTimer() {
    if(timer) return;
    timer = setInterval(()=>{
      seconds++;
      timeEl.textContent = formatTime(seconds);
    },1000);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  /* ------------------ SAVE GAME STATE ------------------ */
  const saveGame = (active) => {
    localStorage.setItem(GAME_KEY,
      JSON.stringify({
        inGame: active,
        theme: themeSelect.value,
        grid: diffSelect.value
      })
    );
  };

  const loadGame = () => JSON.parse(localStorage.getItem(GAME_KEY)||"null");

  /* ------------------ BUILD GAME BOARD ------------------ */
  function build() {

    stopTimer();
    seconds=0; moves=0; matched=0; lock=false; first=second=null;
    timeEl.textContent="00:00";
    movesEl.textContent="0";

    board.innerHTML="";

    const size = +diffSelect.value;
    totalCards = size * size;

    /* Apply 6×6 mobile class */
    board.classList.toggle("six-grid", size === 6);

    let pool = [...THEMES[themeSelect.value]];
    while (pool.length < totalCards/2) pool.push(...pool);

    let chosen = pool.slice(0, totalCards/2);
    let deck = [...chosen, ...chosen].sort(()=>Math.random()-0.5);

    board.style.gridTemplateColumns = `repeat(${size},1fr)`;

    deck.forEach(face=>{
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.face = face;

      card.innerHTML = `
        <div class="inner">
          <div class="face front">${face}</div>
          <div class="face back"></div>
        </div>
      `;

      card.addEventListener("click",()=>flip(card));
      board.appendChild(card);
    });

    loadBest();
    saveGame(true);
  }

  /* ------------------ FLIP CARD ------------------ */
  function flip(card) {
    if(lock || card===first) return;

    flipSound();
    if(!timer) startTimer();

    card.classList.add("flip");

    if(!first){
      first = card;
      return;
    }

    second = card;
    moves++; movesEl.textContent=moves;

    if(first.dataset.face === second.dataset.face){
      matchSound();
      matched += 2;

      setTimeout(()=>{
        first.classList.add("matched");
        second.classList.add("matched");
        first = second = null;

        if(matched === totalCards) win();
      },250);

    } else {
      lock = true;
      setTimeout(()=>{
        first.classList.remove("flip");
        second.classList.remove("flip");
        first = second = null;
        lock = false;
      },650);
    }
  }

  /* ------------------ WIN GAME ------------------ */
  function win() {
    stopTimer();
    winSound();
    confetti();

    const score = Math.max(0, 10000 - (moves*15 + seconds*12));

    resultEl.innerHTML = `
      Moves: <b>${moves}</b><br>
      Time: <b>${formatTime(seconds)}</b><br>
      Score: <b>${score}</b>
    `;

    modal.style.display="grid";
    saveBest(score);
    loadBest();
  }

  /* ------------------ BUTTON CLICK HANDLERS ------------------ */
  startBtn.addEventListener("click",()=>{
    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    build();
  });

  backBtn.addEventListener("click",()=>{
    stopTimer();
    modal.style.display="none";
    gameScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    saveGame(false);
  });

  newGameBtn.addEventListener("click", build);

  playAgain.addEventListener("click",()=>{
    modal.style.display="none";
    build();
  });

  closeModal.addEventListener("click",()=>{
    modal.style.display="none";
  });

  /* ------------------ AUTO RESTORE GAME ON REFRESH ------------------ */
  const state = loadGame();
  if(state && state.inGame){
    themeSelect.value = state.theme;
    diffSelect.value  = state.grid;

    startScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    build();
  }

  loadBest();

})();
