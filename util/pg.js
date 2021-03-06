class Pg {
    constructor(postgres) {
        this.postgres = postgres;
    }

    addGuild(guildID) {
        if (!guildID) return new Error("no guild ID");
        return this.postgres.query({
            "text": "INSERT INTO guilds (id, current, lasttime, timeout, meme, activityrole, dont, starboard, emoji) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
            "values": [guildID, 0, 0, 12, false, 0, false, 0, "⭐"]
        });
    }

    removeGuild(guildID) {
        if (!guildID) return new Error("no guild ID");
        return this.postgres.query({
            "text": "DELETE FROM guilds WHERE id = $1;",
            "values": [guildID]
        });
    }

    getGcfg(guildID) {

        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT * FROM guilds WHERE id = $1;",
                "values": [guildID]
            }).catch((err) => reject(err)).then((res) => {
                resolve(res.rows[0]);
            });
        });
    }

    updateCurrent(guildID, imageID) {
        return this.postgres.query({
            "text": "UPDATE guilds SET current = $1, lasttime = $2 WHERE id = $3;",
            "values": [imageID, Date.now(), guildID]
        });
    }

    updateTimeout(guildID, timeout) {
        return this.postgres.query({
            "text": "UPDATE guilds SET timeout = $1 WHERE id = $2;",
            "values": [timeout, guildID]
        });
    }

    flipMeme(guildID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT (meme) FROM guilds WHERE id = $1;",
                "values": [guildID]
            }).catch((err) => reject(err)).then((res) => {
                let meme = res.rows[0].meme;
                meme = !meme;

                this.postgres.query({
                    "text": "UPDATE guilds SET meme = $1 WHERE id = $2;",
                    "values": [meme, guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve({ "meme": meme, "res": res });
                });
            });
        });
    }

    updateActivity(guildID, roleID) {
        return this.postgres.query({
            "text": "UPDATE guilds SET activityrole = $1 WHERE id = $2;",
            "values": [roleID || 0, guildID]
        });
    }

    updateSlowrole(guildID, roleID) {
        return this.postgres.query({
            "text": "UPDATE guilds SET slowrole = $1 WHERE id = $2;",
            "values": [roleID || 0, guildID]
        });
    }

    makeDont(guildID) {
        return this.postgres.query({
            "text": "UPDATE guilds SET dont = 't' WHERE id = $1;",
            "values": [guildID]
        });
    }

    makeDo(guildID) {
        return this.postgres.query({
            "text": "UPDATE guilds SET dont = 'f' WHERE id = $1;",
            "values": [guildID]
        });
    }

    updateStarboardChannel(guildID, channelID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "UPDATE guilds SET starboard = $1 WHERE id = $2;",
                "values": [channelID || 0, guildID]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "SELECT starboard FROM guilds WHERE id = $1;",
                    "values": [guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve(res.rows[0]);
                });
            })
        });
    }

    updateStarboardEmoji(guildID, emoji) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "UPDATE guilds SET emoji = $1 WHERE id = $2;",
                "values": [emoji || "⭐", guildID]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "SELECT emoji FROM guilds WHERE id = $1;",
                    "values": [guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve(res.rows[0]);
                });
            })
        });
    }

    getStarCfg(guildID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT starboard, emoji FROM guilds WHERE id = $1;",
                "values": [guildID]
            }).catch((err) => reject(err)).then((res) => {
                resolve(res.rows[0]);
            });
        });
    }

    getStarStatus(messageID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT * FROM starboard WHERE msg = $1;",
                "values": [messageID]
            }).catch((err) => reject(err)).then((res) => {
                if (res.rows.length == 1) {
                    resolve(res.rows[0])
                } else {
                    resolve("dne");
                }
            });
        });
    }

    createStar(guildID, memberID, channelID, msgID, memberName, channelName, firstID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "INSERT INTO starboard (date, guild, member, channel, msg, post, membername, channelname, stars, who) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
                "values": [
                    Date.now(),
                    guildID,
                    memberID,
                    channelID,
                    msgID,
                    0,
                    memberName,
                    channelName,
                    1,
                    { "who": [firstID] }
                ]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "SELECT * FROM starboard WHERE msg = $1;",
                    "values": [msgID]
                }).catch((err) => reject(err)).then((res) => {
                    res.rows[0].dne = true;
                    resolve(res.rows[0]);
                });
            });
        });
    }

    addPost(msgID, postID) {
        return this.postgres.query({
            "text": "UPDATE starboard SET post = $1 WHERE msg = $2",
            "values": [postID, msgID]
        });
    }

    incrementStar(msgID, whoID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT who FROM starboard WHERE msg = $1;",
                "values": [msgID]
            }).catch((err) => reject(err)).then((res) => {
                let who = res.rows[0].who.who;
                who.push(whoID);
                who = who.filter((item, index, array) => index === array.indexOf(item));

                this.postgres.query({
                    "text": "UPDATE starboard SET stars = $1, who = $2 WHERE msg = $3;",
                    "values": [who.length, { "who": who }, msgID]
                }).catch((err) => reject(err)).then((res) => {
                    this.postgres.query({
                        "text": "SELECT * FROM starboard WHERE msg = $1;",
                        "values": [msgID]
                    }).catch((err) => reject(err)).then((res) => {
                        res.rows[0].dne = false;
                        resolve(res.rows[0]);
                    });
                });
            });
        });
    }

    decrementStar(msgID, whoID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT who FROM starboard WHERE msg = $1;",
                "values": [msgID]
            }).catch((err) => reject(err)).then((res) => {
                let who = res.rows[0].who.who;
                who.splice(who.indexOf(whoID), 1);
                who = who.filter((item, index, array) => index === array.indexOf(item));

                if (who.length > 0) {
                    this.postgres.query({
                        "text": "UPDATE starboard SET stars = $1, who = $2 WHERE msg = $3;",
                        "values": [who.length, { "who": who }, msgID]
                    }).catch((err) => reject(err)).then((res) => {
                        this.postgres.query({
                            "text": "SELECT * FROM starboard WHERE msg = $1;",
                            "values": [msgID]
                        }).catch((err) => reject(err)).then((res) => {
                            res.rows[0].dne = false;
                            resolve(res.rows[0]);
                        });
                    });
                } else {
                    this.removeStar(msgID).then((res) => resolve(res)).catch((err) => reject(err));
                }
            });
        });
    }

    removeStar(msgID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT * FROM starboard WHERE msg = $1;",
                "values": [msgID]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "DELETE FROM starboard WHERE msg = $1;",
                    "values": [msgID]
                }).catch((err) => reject(err)).then((res2) => resolve({
                    "dne": true,
                    "post": res.rows[0].post
                }));
            });
        });
    }

    getStarStats(guildID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT * FROM starboard WHERE guild = $1 ORDER BY stars DESC;",
                "values": [guildID]
            }).catch((err) => reject(err)).then((res) => {
                res.rows.forEach((row) => {
                    row.who = row.who.who;
                });

                resolve(res.rows);
            });
        });
    }

    cleanStars(guildID, threshold, time = 604800000) {
        return new Promise((resolve, reject) => {
            let then = Date.now() - time;
            this.postgres.query({
                "text": "SELECT * FROM starboard WHERE guild = $1 AND stars <= $2 AND date >= $3;",
                "values": [guildID, threshold, then]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "DELETE FROM starboard WHERE guild = $1 AND stars <= $2 AND date >= $3;",
                    "values": [guildID, threshold, then]
                }).catch((err) => reject(err)).then((res2) => {
                    resolve(res.rows);
                });
            });
        });
    }

    checkStarWho(messageID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT who FROM starboard WHERE msg = $1;",
                "values": [messageID]
            }).catch((err) => reject(err)).then((res) => {
                resolve(res.rows[0].who.who);
            });
        });
    }

    upsertRole(role, code, guildID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": [
                    "INSERT INTO roles VALUES ($1, $2, $3) ON CONFLICT (role) DO",
                    "UPDATE SET invitecode = $2 WHERE roles.role = $1;"
                ].join(" "),
                "values": [role, code, guildID]
            }).catch((err) => reject(err)).then((res) => {
                resolve();
            });
        });
    }

    getCodes() {
        return new Promise((resolve, reject) => {
            this.postgres.query("SELECT invitecode FROM roles;")
                .catch((err) => reject(err))
                .then((res) => {
                    resolve(res.rows.map((row) => row.invitecode));
                });
        });
    }

    getRole(code) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                text: "SELECT role FROM roles WHERE invitecode = $1;",
                values: [code]
            }).catch((err) => reject(err)).then((res) => {
                resolve(res.rows[0].role);
            });
        });
    }

    updatePinboardInChannel(guildID, channelID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "UPDATE guilds SET pinboardin = $1 WHERE id = $2;",
                "values": [channelID || 0, guildID]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "SELECT pinboardin FROM guilds WHERE id = $1;",
                    "values": [guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve(res.rows[0]);
                });
            })
        });
    }

    updatePinboardOutChannel(guildID, channelID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "UPDATE guilds SET pinboardout = $1 WHERE id = $2;",
                "values": [channelID || 0, guildID]
            }).catch((err) => reject(err)).then((res) => {
                this.postgres.query({
                    "text": "SELECT pinboardout FROM guilds WHERE id = $1;",
                    "values": [guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve(res.rows[0]);
                });
            })
        });
    }

    flipPins(guildID) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT (cleanpins) FROM guilds WHERE id = $1;",
                "values": [guildID]
            }).catch((err) => reject(err)).then((res) => {
                let cleanpins = res.rows[0].cleanpins;
                cleanpins = !cleanpins;

                this.postgres.query({
                    "text": "UPDATE guilds SET cleanpins = $1 WHERE id = $2;",
                    "values": [cleanpins, guildID]
                }).catch((err) => reject(err)).then((res) => {
                    resolve({ "cleanpins": cleanpins, "res": res });
                });
            });
        });
    }

    getActivityRoles() {
        return new Promise((resolve, reject) => {
            this.postgres.query("SELECT id, activityrole FROM guilds WHERE activityrole <> 0;")
                .catch((err) => reject(err))
                .then((res) => resolve(res.rows));
        });
    }

    createRolemeRole(id, guild) {
        return this.postgres.query({
            "text": "INSERT INTO roleme (id, guild) VALUES ($1, $2);",
            "values": [id, guild]
        });
    }

    deleteRolemeRole(id) {
        return this.postgres.query({
            "text": "DELETE FROM roleme WHERE id = $1;",
            "values": [id]
        });
    }

    getGuildRolemeRoles(guild) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "SELECT (id) FROM roleme WHERE guild = $1;",
                "values": [guild]
            }).catch((err) => reject(err)).then((res) => resolve(res.rows.map((row) => row.id)));
        });
    }

    toggleRolestate(guild) {
        return new Promise((resolve, reject) => {
            this.postgres.query({
                "text": "UPDATE guilds SET rolestate = NOT rolestate WHERE id = $1 RETURNING rolestate;",
                "values": [guild]
            }).catch((err) => reject(err)).then((res) => resolve(res.rows[0].rolestate));
        });
    }
}

module.exports = Pg;
