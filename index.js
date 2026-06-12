const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const collectBlock = require('mineflayer-collectblock').plugin;
const GoalFollow = goals.GoalFollow;
const readline = require('readline');

let currentBotUsername = 'pocohoco3000';
const botOptions = { host: 'mc.play-fast.ru', port: 25565, username: currentBotUsername, version: '1.16.5', viewDistance: 'tiny', colorsEnabled: false };
const OWNER_NICK = 'SvyatoslavPro123';
let ownersList = ['SvyatoslavPro123'];
let botInstance = null, pvpInterval = null, pvpTargetEntity = null, customCycleInterval = null, currentCycleCommand = null, cycleSeconds = 3;
let isEquipping = false, isEating = false, isToggleArmor = false, isDeadNow = false;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function createBot() {
    botOptions.username = currentBotUsername;
    console.log(`[Система] Запуск ПВП-шахтера под ником: ${currentBotUsername}...`);
    const bot = mineflayer.createBot(botOptions); botInstance = bot;
    bot.loadPlugin(pathfinder); bot.loadPlugin(collectBlock);

    bot.on('spawn', () => {
        console.log(`[Система] Бот ${bot.username} зашел на server.`); isDeadNow = false;
        setTimeout(() => { if (bot.entity) bot.chat('/games'); }, 4000);
        setTimeout(() => {
            if (bot.inventory && bot.inventory.items().length === 0) {
                bot.chat('/anarchy'); setTimeout(() => bot.chat('/anar'), 2000); setTimeout(() => bot.chat('/server anarchy'), 4000);
            }
        }, 10000);
    });

    bot.on('windowOpen', async (w) => {
        await new Promise(r => setTimeout(r, 2000));
        try { await bot.clickWindow(23, 0, 0); } catch (err) { bot.closeWindow(w); }
    });

    bot.on('death', () => {
        console.log('[Защита] Бот погиб! Возрождаюсь...'); isDeadNow = true; bot.respawn();
        setTimeout(() => { isDeadNow = false; if (currentCycleCommand) bot.chat(currentCycleCommand); }, 2500);
    });

    let armorTimer = setInterval(() => { equipArmor(bot); }, 2500);
    let totemTimer = setInterval(() => { checkTotem(bot); }, 1500);
    bot.on('physicTick', () => { if (pvpTargetEntity?.isValid) bot.lookAt(pvpTargetEntity.position.offset(0, 1.6, 0)); });

    // Универсальная функция добычи блоков по их ID
    async function startMining(blockIds, typeName, callback) {
        if (!bot.inventory || isDeadNow) return;
        const targets = bot.findBlocks({ matching: blockIds, maxDistance: 32, count: 5 });
        if (targets.length === 0) { bot.chat(`Я не вижу ${typeName} поблизости!`); return; }
        bot.chat(`Нашел ${typeName}! Спешу добывать...`);
        const blocksToMine = [];
        for (const pos of targets) { const block = bot.blockAt(pos); if (block) blocksToMine.push(block); }
        try {
            const mcData = require('minecraft-data')(bot.version);
            const defaultMove = new Movements(bot, mcData); defaultMove.canDig = true; bot.pathfinder.setMovements(defaultMove);
            await bot.collectBlock.collect(blocksToMine); bot.chat(`Успешно добыл ${typeName}! Ищу дальше...`);
            setTimeout(callback, 2000);
        } catch (err) { console.log(`[Шахтер] Микросбой при добыче: ${err.message}`); }
    }

    function startMiningDiamonds() {
        const mcData = require('minecraft-data')(bot.version);
        const diamondOreIds = [mcData.blocksByName.diamond_ore?.id, mcData.blocksByName.deepslate_diamond_ore?.id].filter(Boolean);
        startMining(diamondOreIds, 'алмазную руду', startMiningDiamonds);
    }

    function startMiningEmeralds() {
        const mcData = require('minecraft-data')(bot.version);
        const emeraldOreIds = [mcData.blocksByName.emerald_ore?.id, mcData.blocksByName.deepslate_emerald_ore?.id].filter(Boolean);
        startMining(emeraldOreIds, 'изумрудную руду', startMiningEmeralds);
    }

    function startMiningNetherite() {
        const mcData = require('minecraft-data')(bot.version);
        const netheriteId = [mcData.blocksByName.ancient_debris?.id].filter(Boolean);
        startMining(netheriteId, 'древние обломки (незерит)', startMiningNetherite);
    }

    bot.on('messagestr', (msg) => {
        const clean = msg.trim(), lowerLine = clean.toLowerCase(); console.log(`[Чат игры]: ${clean}`);
        const isOwnerAction = ownersList.some(owner => lowerLine.includes(owner.toLowerCase()));
        if (isOwnerAction && (lowerLine.includes('телепорт') || lowerLine.includes('tpa') || lowerLine.includes('просит'))) {
            setTimeout(() => bot.chat('/tpaccept'), 1000); return;
        }
        if (!isOwnerAction || !lowerLine.includes('*')) return;
        const activeOwner = ownersList.find(owner => lowerLine.includes(owner.toLowerCase())) || OWNER_NICK;

        if (lowerLine.includes('*mine diamond')) { resetAllTimers(); bot.pathfinder.setGoal(null); startMiningDiamonds(); return; }
        if (lowerLine.includes('*mine emerald')) { resetAllTimers(); bot.pathfinder.setGoal(null); startMiningEmeralds(); return; }
        if (lowerLine.includes('*mine netherite')) { resetAllTimers(); bot.pathfinder.setGoal(null); startMiningNetherite(); return; }
        if (lowerLine.includes('*tp')) { resetAllTimers(); bot.chat(`/tpa ${activeOwner}`); return; }
        if (lowerLine.includes('*cycle')) {
            if (customCycleInterval) clearInterval(customCycleInterval);
            const match = clean.match(/\* c y c l e\s+(\d+)\s+(.+)$/i); if (!match) return;
            cycleSeconds = parseInt(match[1]); let targetCmd = match[2].trim(); currentCycleCommand = targetCmd;
            bot.chat(`Цикл "${targetCmd}" каждые ${cycleSeconds} сек.`); bot.chat(targetCmd);
            customCycleInterval = setInterval(() => { if (!isDeadNow) bot.chat(targetCmd); }, cycleSeconds * 1000);
            return;
        }
        if (lowerLine.includes('*kill')) {
            if (pvpInterval) clearInterval(pvpInterval);
            const cmdIndex = lowerLine.indexOf('*kill'); let raw = clean.substring(cmdIndex + 5).trim(); if (!raw) return;
            let act = Object.keys(bot.players).find(p => p.toLowerCase() === raw.toLowerCase()); pvpTargetEntity = bot.players[act]?.entity;
            if (!pvpTargetEntity) { bot.chat(`Я не вижу цель ${raw}!`); return; }
            bot.chat(`Атакую игрока ${act} критами!`);
            const move = new Movements(bot, require('minecraft-data')(bot.version)); bot.pathfinder.setMovements(move); bot.pathfinder.setGoal(new GoalFollow(pvpTargetEntity, 1.5), true);
            pvpInterval = setInterval(() => {
                if (isEating || isEquipping || isToggleArmor || isDeadNow) return;
                if (bot.entity && bot.entity.position.distanceTo(pvpTargetEntity.position) <= 3.8) {
                    bot.setControlState('jump', true);
                    setTimeout(() => { bot.setControlState('jump', false); bot.attack(pvpTargetEntity); bot.swingArm(); }, 150);
                }
            }, 650);
            return;
        }
        if (lowerLine.includes('*stop')) { resetAllTimers(); bot.pathfinder.setGoal(null); bot.chat('Все действия остановлены.'); }
    });

    function cleanSessionTimers() { clearInterval(armorTimer); clearInterval(totemTimer); resetAllTimers(); }
    bot.on('kick', (r) => { cleanSessionTimers(); setTimeout(createBot, 15000); });
    bot.on('end', () => { cleanSessionTimers(); setTimeout(createBot, 15000); });
    bot.on('error', (e) => console.error(e.message));
}

function resetAllTimers() {
    if (pvpInterval) clearInterval(pvpInterval); if (customCycleInterval) clearInterval(customCycleInterval);
    pvpInterval = null; customCycleInterval = null; currentCycleCommand = null; pvpTargetEntity = null; isEquipping = false; isEating = false; isToggleArmor = false;
}

rl.removeAllListeners('line');
rl.on('line', (line) => {
    let text = line.trim(); if (text.length === 0) return;
    let lowerText = text.toLowerCase();
    if (lowerText.startsWith('bot nick ')) {
        let newNick = text.substring(9).trim();
        if (newNick.length > 2) { currentBotUsername = newNick; console.log(`[Система] Переподключение под ником "${newNick}"...`); if (botInstance) botInstance.quit(); }
        return;
    }
    if (lowerText.startsWith('owner add ')) {
        let name = text.substring(10).trim();
        if (name && !ownersList.some(o => o.toLowerCase() === name.toLowerCase())) { ownersList.push(name); console.log(`[Управление] Добавлен: ${name}`); }
        return;
    }
    if (lowerText.startsWith('owner remove ')) {
        let name = text.substring(13).trim(); ownersList = ownersList.filter(o => o.toLowerCase() !== name.toLowerCase()); console.log(`[Управление] Удален: ${name}`); return;
    }
    if (lowerText === 'owner list') { console.log(`[Управление] Владельцы: ${ownersList.join(', ')}`); return; }
    if (botInstance && botInstance.entity) { botInstance.chat(text); console.log(`[Ты из консоли]: ${text}`); }
});

async function checkTotem(bot) {
    if (!bot.inventory || isEating || isEquipping || isToggleArmor || bot.inventory.items().length === 0 || isDeadNow) return;
    let totem = bot.inventory.items().find(i => i && i.name === 'totem_of_undying'); if (!totem || totem.slot === undefined) return;
    isToggleArmor = true;
    try {
        await bot.clickWindow(totem.slot, 0, 0); await new Promise(r => setTimeout(r, 350));
        await bot.clickWindow(45, 0, 0); await new Promise(r => setTimeout(r, 350));
        if (bot.inventory.selectedItem) await bot.clickWindow(totem.slot, 0, 0);
    } catch (e) {}
    isToggleArmor = false;
}

async function equipArmor(bot) {
    if (!bot.inventory || isEquipping || isEating || isToggleArmor || bot.inventory.items().length === 0 || isDeadNow) return;
    const types = ['helmet', 'chestplate', 'leggings', 'boots'];
    for (let index = 0; index < types.length; index++) {
        const type = types[index];

