const fs = require("fs");
const util = require("util");
const upone = require("../util/upone");
var Canvas = require("canvas");
var Image = Canvas.Image;

function meme(data, gcfg) {
    return new Promise((resolve) => {
        if (gcfg.meme && Math.floor(Math.random() * 10) == 0) {
            fs.readFile("./fake_notify.png", (err, fake) => {
                let __upone = upone(__dirname);
                var canvas = new Canvas(128, 128);
                var ctx = canvas.getContext("2d");
                let layer1 = new Image();
                let layer2 = new Image();
                layer1.src = data;
                layer2.src = fake;

                ctx.drawImage(layer1, 0, 0, 128, 128);
                ctx.drawImage(layer2, 0, 0, 128, 128);

                let buffers = [];
                canvas.pngStream().on("data", (buffer) => {
                    buffers.push(buffer);
                }).on("end", () => {
                    resolve(Buffer.concat(buffers));
                });
            });
        } else {
            resolve(data);
        }
    });
}

module.exports = (guild, channel, dirlist, gcfg, path) => {
    let to_rotate = dirlist[Math.floor(Math.random() * dirlist.length)];
    path = `${path}/${to_rotate}`;

    fs.readFile(path, (err, data) => {
        meme(data, gcfg[guild.id]).then(data => {
            guild.edit({
                icon: "data:image/jpg;base64," + data.toString("base64")
            }).then(guild => {
                if (channel) channel.createMessage(":recycle:");
                util.log(`rotated on ${guild.id}/${guild.name}`);

                gcfg[guild.id].lasttime = Date.now();
                gcfg[guild.id].current = to_rotate.split(".")[0];

                fs.writeFile("./gcfg.json", JSON.stringify(gcfg), (err) => {
                    if (err) util.log(err);
                });
            }).catch(err => util.error(err));  
        }).catch(err => {
            util.error(err);
        })
    });
};
