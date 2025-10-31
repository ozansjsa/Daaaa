require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const express = require('express');

const PREFIX = '.';
const SPAM_LIMIT = 4;
const SPAM_INTERVAL = 5000;
const MUTE_ROLE_NAME = 'Muted';
const tempMutes = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const spamMap = new Map();

async function ensureMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === MUTE_ROLE_NAME);
  if (!role) {
    role = await guild.roles.create({
      name: MUTE_ROLE_NAME,
      reason: 'Muted rolü bot tarafından oluşturuldu',
      permissions: []
    });
    for (const [, ch] of guild.channels.cache) {
      try {
        await ch.permissionOverwrites.edit(role, {
          SendMessages: false,
          AddReactions: false,
          Speak: false
        });
      } catch (err) {}
    }
  }
  return role;
}

function sendTempMessage(channel, text, time = 2000) {
  channel.send(text).then(m => setTimeout(() => m.delete().catch(()=>{}), time));
}

client.on('ready', () => {
  console.log(`${client.user.tag} hazır!`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  // spam kontrol
  const gId = message.guild.id;
  if (!spamMap.has(gId)) spamMap.set(gId, new Map());
  const guildSpam = spamMap.get(gId);

  if (!guildSpam.has(message.author.id)) guildSpam.set(message.author.id, []);
  const arr = guildSpam.get(message.author.id);

  const now = Date.now();
  arr.push({ t: now, content: message.content });
  while (arr.length > SPAM_LIMIT) arr.shift();

  if (arr.length >= SPAM_LIMIT && (now - arr[0].t) <= SPAM_INTERVAL) {
    const member = message.member;
    try {
      const role = await ensureMuteRole(message.guild);
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, 'Orospu çocuğu spam yaptığı için mute!');
      }
      sendTempMessage(message.channel, `${member}, orospu çocuğu spam yapma!`);
      const key = `${message.guild.id}-${member.id}`;
      if (tempMutes.has(key)) clearTimeout(tempMutes.get(key));
      const t = setTimeout(async () => {
        try { await member.roles.remove(role, 'Orospu çocuğu mute süresi doldu!'); } catch (e){}
        tempMutes.delete(key);
      }, 60000);
      tempMutes.set(key, t);
    } catch (e) {}
    guildSpam.set(message.author.id, []);
    return;
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const hasMod = (member) => member.permissions.has(PermissionsBitField.Flags.ManageMessages)
                      || member.permissions.has(PermissionsBitField.Flags.BanMembers)
                      || member.roles.cache.some(r => r.name.toLowerCase().includes('moderator'))
                      || member.roles.cache.some(r => r.name.toLowerCase().includes('mod'));

  // .sil
  if (cmd === 'sil') {
    if (!hasMod(message.member)) return;
    const count = Math.min(100, Math.max(1, parseInt(args[0] || '1')));
    try {
      const deleted = await message.channel.bulkDelete(count, true);
      sendTempMessage(message.channel, `Orospu çocuğu, ${deleted.size} mesajı sildim!`);
    } catch (e) {}
  }

  // .ban
  if (cmd === 'ban') {
    if (!hasMod(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return;
    try {
      await target.ban({ reason: 'Orospu çocuğu banlandı!' });
      sendTempMessage(message.channel, `${target.user.tag}, orospu çocuğu, banlandın!`);
    } catch (e) {}
  }

  // .unban
  if (cmd === 'unban') {
    if (!hasMod(message.member)) return;
    const id = args[0];
    if (!id) return;
    try {
      await message.guild.bans.remove(id);
      sendTempMessage(message.channel, `${id}, orospu çocuğu, unbanlandın!`);
    } catch (e) {}
  }

  // .mute
  if (cmd === 'mute') {
    if (!hasMod(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return;
    try {
      const role = await ensureMuteRole(message.guild);
      if (!target.roles.cache.has(role.id)) await target.roles.add(role, 'Orospu çocuğu mute!');
      sendTempMessage(message.channel, `${target.user.tag}, orospu çocuğu susturuldun!`);
    } catch (e) {}
  }

  // .unmute
  if (cmd === 'unmute') {
    if (!hasMod(message.member)) return;
    const target = message.mentions.members.first();
    if (!target) return;
    try {
      const role = await ensureMuteRole(message.guild);
      if (target.roles.cache.has(role.id)) await target.roles.remove(role, 'Orospu çocuğu unmute!');
      sendTempMessage(message.channel, `${target.user.tag}, orospu çocuğu, artık konuşabilirsin!`);
    } catch (e) {}
  }

});

// Basit webserver
const app = express();
app.get('/', (req, res) => res.send('Orospu çocuğu bot aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server çalışıyor.'));

client.login(process.env.TOKEN);
