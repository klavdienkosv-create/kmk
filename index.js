const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;

const botOptions = { host: 'mc.play-fast.ru', port: 25565, username: 'pocohoco3000', version: '1.16.5', viewDistance: 'tiny', colorsEnabled: false, concurrency: 1 };
const OWNER_NICK = 'SvyatoslavPro123'; 

let lookTargetEntity = null, pvpInterval = null, pvpTargetEntity = null, customCycleInterval = null; 
let isEquipping = false, isEating = false, isToggleArmor = false; 

function createBot() {
  console.log('[Система] Запуск ПВП-терминатора pocohoco3000...');
  const bot = mineflayer.createBot(botOptions);
  bot.loadPlugin(pathfinder);

  bot.on('spawn', () => {
    console.log(`[Система] Бот ${bot.username} зашел на сервер.`);
    resetAllTimers();
    setTimeout(() => { if (bot.entity) bot.chat('/games'); }, 4000);
    setTimeout(() => {
      if (bot.inventory && bot.inventory.items().length === 0) {
        bot.chat('/anarchy');
        setTimeout(() => bot.chat('/anar'), 2000);
        setTimeout(() => bot.chat('/server anarchy'), 4000);
      }
    }, 10000);
  });

  bot.on('windowOpen', async (window) => {
    await new Promise(r => setTimeout(r, 2000));
    try { await bot.clickWindow(23, 0, 0); } catch (err) { bot.closeWindow(window); }
  });

  setInterval(() => { equipBestArmorClicks(); }, 2500);
  setInterval(() => { checkAndEquipTotem(); }, 1500);

  bot.on('physicTick', () => {
    let t = pvpTargetEntity?.isValid ? pvpTargetEntity : (lookTargetEntity ? lookTargetEntity : bot.players[Object.keys(bot.players).find(p => p.toLowerCase() === OWNER_NICK.toLowerCase())]?.entity);
    if (t) bot.lookAt(t.position.offset(0, 1.6, 0));
  });

  function resetAllTimers() {
    if (pvpInterval) clearInterval(pvpInterval);
    if (customCycleInterval) clearInterval(customCycleInterval); 
    pvpInterval = null; customCycleInterval = null; pvpTargetEntity = null; lookTargetEntity = null;
    isEquipping = false; isEating = false; isToggleArmor = false;
  }

  async function checkAndEquipTotem() {
    if (!bot.inventory || isEating || isEquipping || isToggleArmor || bot.inventory.items().length === 0) return;
    if (bot.inventory.slots[45]?.name === 'totem_of_undying') return;
    let totem = bot.inventory.items().find(i => i && i.name === 'totem_of_undying');
    if (!totem || totem.slot === undefined) return;
    isToggleArmor = true;
    try {
      await bot.clickWindow(totem.slot, 0, 0); await new Promise(r => setTimeout(r, 350));
      await bot.clickWindow(45, 0, 0); await new Promise(r => setTimeout(r, 350));
      if (bot.inventory.selectedItem) await bot.clickWindow(totem.slot, 0, 0);
    } catch (e) {}
    isToggleArmor = false;
  }

  async function equipBestArmorClicks() {
    if (!bot.inventory || isEquipping || isEating || isToggleArmor || bot.inventory.items().length === 0) return;
    const types = ['helmet', 'chestplate', 'leggings', 'boots'], mats = { netherite: 5, diamond: 4, iron: 3, chainmail: 2, gold: 1, leather: 0 };
    for (let index = 0; index < types.length; index++) {
      const type = types[index];
      const items = bot.inventory.items().filter(item => {
        if (!item || !item.name) return false;
        let c = item.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        return type === 'helmet' ? (c.includes('helmet') || c.includes('head')) : type === 'chestplate' ? (c.includes('chestplate') || c.includes('chest')) : type === 'leggings' ? (c.includes('leggings') || c.includes('legs')) : (c.includes('boots') || c.includes('feet'));
      });
      if (items.length === 0) continue;
      let best = items[0]; if (!best || !best.name) continue;
      for (let i = 1; i < items.length; i++) {
        if (!items[i]?.name || !best?.name) continue;
        if ((mats[Object.keys(mats).find(m => items[i].name.toLowerCase().includes(m)) || 'leather']) > (mats[Object.keys(mats).find(m => best.name.toLowerCase().includes(m)) || 'leather'])) best = items[i];
      }
      if (!best || best.slot === undefined) continue;
      let eq = bot.inventory.slots[5 + index];
      let should = !eq || !eq.name;
      if (eq && eq.name && best.name) {
        let eqM = mats[Object.keys(mats).find(m => eq.name.toLowerCase().includes(m)) || 'leather'], bM = mats[Object.keys(mats).find(m => best.name.toLowerCase().includes(m)) || 'leather'];
        if (bM > eqM) should = true;
      }
      if (should) {
        isEquipping = true;
        try {
          await bot.clickWindow(best.slot, 0, 0); await new Promise(r => setTimeout(r, 400)); 
          await bot.clickWindow(5 + index, 0, 0); await new Promise(r => setTimeout(r, 400));
          if (bot.inventory.selectedItem) { await bot.clickWindow(best.slot, 0, 0); await new Promise(r => setTimeout(r, 400)); }
        } catch (err) {}
        isEquipping = false; return; 
      }
    }
  }

  function equipBestSwordFromHotbar() {
    if (!bot.inventory) return;
    const mats = { netherite: 5, diamond: 4, iron: 3, gold: 2, stone: 1, wood: 0 };
    let bestSlot = null, maxVal = -1;
    for (let i = 0; i < 9; i++) {
      const item = bot.inventory.slots[36 + i];
      if (item && item.name && item.name.toLowerCase().replace(/[^a-z0-9_]/g, '').includes('sword')) {
        let v = mats[Object.keys(mats).find(m => item.name.toLowerCase().replace(/[^a-z0-9_]/g, '').includes(m)) || 'wood'];
        if (v > maxVal) { maxVal = v; bestSlot = i; }
      }
    }
    if (bestSlot !== null) bot.setQuickBarSlot(bestSlot);
  }

  async function checkAndEatApple() {
    if (bot.health < 12 && !isEating && bot.inventory && !isEquipping && !isToggleArmor) {
      let idx = null, ench = false;
      for (let i = 0; i < 9; i++) { if (bot.inventory.slots[36 + i]?.name?.toLowerCase().includes('enchanted_golden_apple')) { idx = i; ench = true; break; } }
      if (idx === null) { for (let i = 0; i < 9; i++) { if (bot.inventory.slots[36 + i]?.name?.toLowerCase().includes('golden_apple')) { idx = i; break; } } }
      if (idx !== null) {
        isEating = true;
        try {
          bot.setQuickBarSlot(idx); await new Promise(r => setTimeout(r, 250));
          bot.activateItem(); await new Promise(r => setTimeout(r, 1800)); bot.deactivateItem(); 
          equipBestSwordFromHotbar(); 
        } catch (err) { equipBestSwordFromHotbar(); }
        isEating = false;
      }
    }
  }

  bot.on('health', () => { checkAndEatApple(); });

  bot.on('messagestr', (msg) => {
    const clean = msg.trim(), lower = clean.toLowerCase();
    console.log(`[Чат игры]: ${clean}`);
    if (clean.includes(OWNER_NICK) && (lower.includes('телепорт') || lower.includes('tpa') || lower.includes('просит'))) {
      setTimeout(() => bot.chat('/tpaccept'), 1000); return; 
    }
    const pos = clean.indexOf(OWNER_NICK); if (pos === -1) return; 
    const cmd = clean.substring(pos).toLowerCase();

    if (cmd.includes('*follow')) {
      resetAllTimers();
      let raw = cmd.substring(cmd.indexOf('*follow') + 8).trim(); if (!raw) return;
      let act = Object.keys(bot.players).find(p => p.toLowerCase() === raw.toLowerCase());
      let ent = bot.players[act]?.entity;
      if (!ent) { bot.chat(`Я не вижу игрока ${raw}!`); return; }
      const move = new Movements(bot, require('minecraft-data')(bot.version));
      move.canDig = false; move.allowParkour = true; move.swimInWater = true;
      bot.pathfinder.setMovements(move); bot.pathfinder.setGoal(new GoalFollow(ent, 1), true);
      lookTargetEntity = ent; bot.chat(`Иду за игроком ${act}!`);
    }

    if (cmd.includes('*tp')) { resetAllTimers(); bot.pathfinder.setGoal(null); bot.chat(`/tpa ${OWNER_NICK}`); }

    if (cmd.includes('*cycle')) {
      resetAllTimers(); bot.pathfinder.setGoal(null);
      let params = clean.substring(pos + cmd.indexOf('*cycle') + 6).trim().split(' ');
      let sec = parseInt(params[0]), targetCmd = params.slice(1).join(' ');
      if (isNaN(sec) || !targetCmd) return;
      bot.chat(`Запускаю цикл "${targetCmd}" каждые ${sec} сек.`); bot.chat(targetCmd);
      customCycleInterval = setInterval(() => { if (bot.entity) bot.chat(targetCmd); }, sec * 1000);
    }

    if (cmd.includes('*kill')) {
      resetAllTimers(); bot.pathfinder.setGoal(null);
      let raw = cmd.substring(cmd.indexOf('*kill') + 5).trim(); if (!raw) return;
      let act = Object.keys(bot.players).find(p => p.toLowerCase() === raw.toLowerCase());
      pvpTargetEntity = bot.players[act]?.entity;
      if (!pvpTargetEntity) { bot.chat(`Я не вижу цель ${raw}!`); return; }
      equipBestSwordFromHotbar(); bot.chat(`Атакую игрока ${act} критами!`);
      const move = new Movements(bot, require('minecraft-data')(bot.version));
      bot.pathfinder.setMovements(move); bot.pathfinder.setGoal(new GoalFollow(pvpTargetEntity, 1.5), true);
      pvpInterval = setInterval(() => {
        if (isEating || isEquipping || isToggleArmor) return;
        if (!pvpTargetEntity?.isValid || !bot.entities[pvpTargetEntity.id]) { resetAllTimers(); bot.pathfinder.setGoal(null); return; }
        if (bot.entity.position.distanceTo(pvpTargetEntity.position) <= 3.8) {
          bot.setControlState('jump', true);
          setTimeout(() => { bot.setControlState('jump', false); if (pvpTargetEntity?.isValid) { bot.attack(pvpTargetEntity); bot.swingArm(); } }, 150);
        }
      }, 650);
    }

    if (cmd.includes('*stop')) { resetAllTimers(); bot.pathfinder.setGoal(null); bot.chat('Все действия остановлены.'); }
    if (cmd.includes('*666')) bot.chat('Через _-_ дней я приду');
  });

  bot.on('time', () => { if (bot.entity?.isInWater && !pvpTargetEntity) bot.setControlState('jump', true); });
  setInterval(() => { if (bot.entity && !pvpInterval) bot.swingArm(); }, 15000);
  bot.on('kick', (r) => { resetAllTimers(); setTimeout(createBot, 15000); });
  bot.on('end', () => { resetAllTimers(); setTimeout(createBot, 15000); });
  bot.on('error', (e) => console.error(e.message));
}

createBot();
