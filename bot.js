const config = require("./config");

const util = require("util");
const fs = require("fs");

const Eris = require("eris");
const Redis = require("redis");
const Postgres = require("pg");
const schedule = require("node-schedule");

require("bluebird").promisifyAll(Redis);

const Pg = require("./util/pg");
const resched = require("./util/resched");
const starboardEmbed = require("./util/starboardEmbed");
const today = require("./util/today");

var client = new Eris(config.token, {getAllUsers: true});
var redis = Redis.createClient();
var rsub = Redis.createClient();
client.postgres = new Postgres.Client(config.pg);
client.pg = new Pg(client.postgres);
client.redis = redis;

client.gcfg = {};
client.config = config;

client.watchedCodes = [];
client.invites = new Map();

rsub.subscribe("__keyevent@0__:expired", (err) => {
    if (err) {
        console.log(err);
        process.exit(1);
    } else {
        console.log("subscribed to keyevent expired");
    }
});

const rotate = require("./commands/rotate");

client.commands = {
    "ping": require("./commands/ping"),
    "rotate": rotate,
    "pls": require("./commands/pls"),
    "rotato": rotate,
    "invite": require("./commands/invite"),
    "help": require("./commands/help"),
    "owo": require("./commands/owo"),
    "potato": rotate,
    "list": require("./commands/list"),
    "delete": require("./commands/delete"),
    "timeout": require("./commands/timeout"),
    "show": require("./commands/show"),
    "meme": require("./commands/meme"),
    "eval": require("./commands/eval"),
    "tomato": rotate,
    "🍅": rotate,
    "🥔": rotate,
    "activity": require("./commands/activity"),
    "dont": require("./commands/dont"),
    "do": require("./commands/do"),
    "starboard": require("./commands/starboard"),
    "star": require("./commands/star"),
    "roles": require("./commands/roles"),
    "link": require("./commands/link"),
    "pinboard": require("./commands/pinboard"),
    "cleanpins": require("./commands/cleanpins"),
    "migratepins": require("./commands/migratepins"),
    "pin": require("./commands/pin"),
    "farm": require("./commands/farm"),
    "deactivate": require("./commands/deactivate"),
    "emojis": require("./commands/emojis"),
    "roleme": require("./commands/roleme"),
    "rolestate": require("./commands/rolestate"),
};

client.tasks = {};

client.on("ready", () => {
    util.log("rohrv2 ready.");
    client.editStatus("online", { name: "hecking unbelieveable", type: 0 });

    client.guilds.forEach((guild) => {
        guild.getInvites().then((invites) => {
            invites.forEach((invite) => {
                client.invites.set(invite.code, invite);
            });
            console.log(`set ${invites.length} invite for ${guild.id}/${guild.name}`);
        }).catch((err) => {
            console.log(`couldn't get invites for ${guild.id}/${guild.name}`);
        })
    });
});

client.once("ready", () => {
    client.guilds.forEach((guild) => {
        resched(client, guild.id);
    });

    client.tasks.decay = schedule.scheduleJob("0 * * * *", () => {
        decayActivity().catch((err) => console.error(err));
    });
});

client.on("guildCreate", (guild) => {
    client.pg.addGuild(guild.id).catch((err) => {
        console.error(err);
        console.error(`couldn't add guild ${guild.id}/${guild.name} to db`);
    }).then(() => {
        console.log(`joined guild ${guild.id}/${guild.name}`);
    });
});

client.on("guildDelete", (guild) => {
    client.pg.removeGuild(guild.id).catch((err) => {
        console.error(err);
        console.error(`couldn't remove guild ${guild.id}/${guild.name} from db`);
    }).then(() => {
        console.log(`left guild ${guild.id}/${guild.name}`);
    });
});

function cacheGcfg(guildID) {
    return new Promise((resolve, reject) => {
        if (client.gcfg[guildID] && !client.gcfg[guildID].expired) {
            resolve(JSON.parse(JSON.stringify(client.gcfg[guildID])));
        } else {
            client.pg.getGcfg(guildID).catch((err) => reject(err)).then((gcfg) => {
                client.gcfg[guildID] = JSON.parse(JSON.stringify(gcfg));
                resolve(JSON.parse(JSON.stringify(client.gcfg[guildID])));
            });
        }
    });
}

async function addRoleFromCode(guildID, memberID, code) {
    try {
        let role = await client.pg.getRole(code);
        await client.addGuildMemberRole(guildID, memberID, role);
    } catch (err) {
        console.error(err);
    }
}

client.on("guildMemberAdd", async function(guild, member) {
    try {
        let gcfg = await cacheGcfg(guild.id);
        if (gcfg.rolestate) {
            let reply = await redis.getAsync(`katze:rolestate:${guild.id}:${member.id}`);
            if (reply) reply = JSON.parse(reply);
            if (reply.length) {
                for (let role of reply) {
                    try { await member.addRole(role); } catch (err) {}
                }
            }
        }

        let invites = await guild.getInvites();
        let unique;
        for (oldInv of client.invites.values()) {
            let x = invites.find((newInv) => newInv.code == oldInv.code & newInv.uses > oldInv.uses);
            if (x) unique = x;
        }

        if (unique) {
            client.invites.set(unique.code, unique);
            if (client.watchedCodes.includes(unique.code)) {
                await addRoleFromCode(guild.id, member.id, unique.code);
                console.log(`added role to ${member.username} on ${guild.name} (code ${unique.code})`);
            }
        }
    } catch (err) {}
});

async function processPin(message) {
    if (!(message.gcfg.pinboardin && message.gcfg.pinboardout)) return;
    if (message.channel.id !== message.gcfg.pinboardin) return;

    try {
        let pins = await message.channel.getPins();
        let embed = starboardEmbed(pins[0]);
        embed.content = "";
        await client.createMessage(message.gcfg.pinboardout, embed);
        if (message.gcfg.cleanpins && pins.length > 49) {
            await client.unpinMessage(message.gcfg.pinboardin, pins[pins.length - 1].id);
        }
    } catch (err) {
        console.error(err);
        console.error("couldn't get pins");
    }
}

const custom = /<:[a-zA-Z1-9-_]{2,}:\d{17,20}>/g;

// scores emoji usage in a guild per day
async function scoreEmojis(message, content) {
    if (message.member.bot) return;

    let emojis = content.match(custom);
    if (!emojis) return;

    let ymd = `emojis:${today()}`;

    for (let emoji of emojis) {
        let id = emoji.split(":")[2].slice(0, -1);

        if (!message.channel.guild.emojis.find((emoji) => emoji.id == id)) return;

        let newscore = await redis.zincrbyAsync(ymd, 1, id);
    }
}

async function addActivity(message) {
    if (message.member.bot) return;

    let roleID = client.gcfg[message.channel.guild.id].activityrole;
    if (!(roleID && roleID != 0)) return;

    let key = `katze:activity:${message.channel.guild.id}:${message.member.id}`;

    try {
        await redis.incrAsync(key);

        if (!~message.member.roles.indexOf(roleID)) {
            await message.member.addRole(roleID);
        }
    } catch (err) {
        console.error(err);
    }
}

function processMessage(message) {
    if (message.type == 6) {
        return processPin(message);
    }

    scoreEmojis(message, message.content.slice());

    let splitContent = message.content.split(" ");

    if (splitContent.shift() == config.defaultPrefix && splitContent[0] in client.commands) {
        message.content = splitContent.join(" ");
        client.commands[splitContent[0]](message, client);
    }

    return addActivity(message);
}

client.on("messageCreate", (message) => {
    if (!message.channel.guild) return;
    if (message.author.id == client.user.id) return;
    if (!message.member || !message.author) return;

    cacheGcfg(message.channel.guild.id).catch((err) => console.error(err)).then((gcfg) => {
        message.gcfg = gcfg;
        return processMessage(message);
    });
});

client.on("messageUpdate", (message) => {
    cacheGcfg(message.channel.guild.id).catch((err) => console.error(err)).then((gcfg) => {
        client.pg.getStarStatus(message.id).catch((err) => {
            console.log("err getting star status within message update");
        }).then((res) => {
            if (res != "dne" && gcfg.starboard > 0) {
                client.editMessage(gcfg.starboard, res.post, starboardEmbed(message, res.stars));
            }
        });
    });
});

client.on("messageDelete", (message) => {
    cacheGcfg(message.channel.guild.id).catch((err) => console.error(err)).then((gcfg) => {
        client.pg.getStarStatus(message.id).catch((err) => {
            console.log("err getting star status within message delete");
        }).then((res) => {
            if (res != "dne" && gcfg.starboard > 0) {
                client.pg.removeStar(message.id).catch((err) => {
                    console.error("err deleting star within message delete");
                }).then((res) => {
                    client.deleteMessage(gcfg.starboard, res.post).catch((err) => {
                        console.error(`couldn't delete starboard post. channel: ${gcfg.starboard}`);
                    });
                });
            }
        });
    });
});

async function onReactionChange(message, emoji, userID, add) {
    emoji = emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;

    let guildID = client.channelGuildMap[message.channel.id];
    if (!guildID) return;

    if (!message.member || !message.content) {
        try {
            message = await client.getMessage(message.channel.id, message.id);
        } catch (err) {
            return;
        }
    }

    let gcfg;
    try {
        gcfg = await cacheGcfg(guildID);
    } catch (err) {
        console.error("error caching gcfg within reactions");
        return;
    }

    if (!gcfg.starboard || gcfg.starboard == 0) return;
    if (emoji != gcfg.emoji) return;
    if (message.member.id == userID) return;

    if (message.channel.id == gcfg.starboard) {

        if (add === false) return;
        if (!message.channel.guild.channels.get(message.channel.id).guild.members.get(client.user.id).permission.has("manageMessages")) return;

        try {
            let ch = message.content.match(/\d{5,}/g)[0];
            let me = message.embeds[0].footer.text.match(/\d{5,}/g)[0];
            if (!(ch && me)) return;

            await client.removeMessageReaction(message.channel.id, message.id, emoji, userID);
            message = await client.getMessage(ch, me);
            await onReactionChange(message, { "name": emoji }, userID, true);
        } catch (err) {
            console.error("couldn't get message within reaction change");
        }
        return;
    }

    let status;
    try {
        status = await client.pg.getStarStatus(message.id);
    } catch (err) {
        console.error("error checking star status within reactions");
    }

    let row;
    if (add === true && status == "dne") {
        try {
            row = await client.pg.createStar(guildID, message.member.id, message.channel.id, message.id,
                                             message.member.username, message.channel.name, userID);
        } catch (err) {
            console.error("error creating star row within reactions");
        }
    } else if (add === true) {
        try {
            row = await client.pg.incrementStar(message.id, userID);
        } catch (err) {
            console.error("error incrementing star");
        }
    } else if (add === false) {
        try {
            row = await client.pg.decrementStar(message.id, userID);
        } catch (err) {
            console.error("error decrementing star");
        }
    }

    if (row.dne === true && row.post > 0) {
        client.deleteMessage(gcfg.starboard, row.post).catch((err) => {
            console.error(`couldn't delete starboard post. channel: ${gcfg.starboard}`);
        });
    } else if (row.dne === true) {
        client.createMessage(gcfg.starboard, starboardEmbed(message, row.stars)).catch((err) => {
            console.error(`couldn't create starboard post. channel: ${gcfg.starboard}`);
        }).then((msg) => {
            client.pg.addPost(message.id, msg.id).catch((err) => {
                console.error("couldn't add post to starboard record");
            });
        });
    } else {
        if (row.post == 0) return;
        client.editMessage(gcfg.starboard, row.post, starboardEmbed(message, row.stars)).catch((err) => {
            console.error("couldn't edit starboard post");
        });
    }
}

client.on("messageReactionAdd", (message, emoji, userID) => onReactionChange(message, emoji, userID, true));
client.on("messageReactionRemove", (message, emoji, userID) => onReactionChange(message, emoji, userID, false));

client.on("guildMemberRemove", (guild, member) => {
    redis.del(`katze:activity:${guild.id}:${member.id}`);

    if (member.roles) redis.set(`katze:rolestate:${guild.id}:${member.id}`, JSON.stringify(member.roles));
});

async function decayGuildActivity(row) {
    let guild = client.guilds.get(row.id);
    if (!guild) return 0;

    if (!guild.roles.get(row.activityrole)) return;

    let members = guild.members.filter((member) => member.roles.includes(row.activityrole));
    if (!members.length) return 0;

    let removed = 0;

    for (let member of members) {
        let key = `katze:activity:${row.id}:${member.id}`;

        let count = await redis.getAsync(key);
        let newCount = Math.floor(count * 0.7);
        await redis.setAsync(key, newCount);

        if (newCount > 10) continue;

        await redis.setAsync(key, 0);
        try {
            await member.removeRole(row.activityrole);
        } catch (err) {
            console.error(`${guild.name}/${member.username}`);
            console.error(err.response);
        }

        removed += 1;
    }

    return removed;
}

async function decayActivity() {
    let rows = await client.pg.getActivityRoles();

    let promises = rows.map((row) => decayGuildActivity(row));
    let results = await Promise.all(promises);

    let amount = results.reduce((a, b) => a + b);
    if (amount) console.log(`removed ${amount} roles from ${results.length} different guilds`);
}

process.on("exit", () => {
    util.log("exiting");
    client.editStatus("invisible");
});

client.postgres.connect((err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log("postgres ready");
    console.log("setting up watched codes");

    client.pg.getCodes().then((codes) => {
        client.watchedCodes.push(...codes);
        client.connect();
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
});

client.on("error", console.error);
