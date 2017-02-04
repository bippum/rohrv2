const download = require("../util/download");

function resched() {
    process.exit();
}

module.exports = (message) => {
    if (!message.member.permission.has("manageGuild")) {
        message.channel.createMessage(":octagonal_sign: u cant upload images sorry!");
        return;
    }

    if (message.mentions.length == 1) {
        download(message.channel.guild.id, message.id, message.mentions[0].avatarURL)
            .then(() => {
                message.channel.createMessage(":white_check_mark: saved your image.").then(() => resched());
            }).catch(() => message.channel.createMessage(":x: couldn't save your image."));
        return;
    } 
    
    if (message.mentions.length > 1) {
        message.channel.createMessage(":octagonal_sign: Please only mention one member.");
        return;
    }
    
    if (message.attachments.length == 1) {
        download(message.channel.guild.id, message.id, message.attachments[0].url)
            .then(() => {
                message.channel.createMessage(":white_check_mark: saved your image.").then(() => resched());
            }).catch(() => message.channel.createMessage(":x: couldn't save your image."));
        return;
    } 

    message.channel.createMessage(":octagonal_sign: pls provide username mentions or an image attachment.");
};
