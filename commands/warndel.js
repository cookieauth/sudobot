const MessageEmbed = require("../src/MessageEmbed");

module.exports = {
    async handle(msg, cm) {
        if (typeof cm.args[0] === 'undefined') {
            await msg.reply({
                embeds: [
                    new MessageEmbed()
                    .setColor('#f14a60')
                    .setDescription(`This command requires at least one argument.`)
                ]
            });

            return;
        }

        await app.db.get('SELECT * FROM warnings WHERE id = ?', [cm.args[0]], async (err, data) => {
            if (err) {
                console.log(err);
            }

            if (!data) {
                await msg.reply({
                    embeds: [
                        new MessageEmbed()
                        .setColor('#f14a60')
                        .setDescription(`No warning found.`)
                    ]
                });
    
                return;
            }

            await app.db.get("DELETE FROM warnings WHERE id = ?", [cm.args[0]], async (err) => {
                if (err) {
                    console.log(err);
                }

                await msg.reply({
                    embeds: [
                        new MessageEmbed()
                        .setDescription('Warning deleted successfully.')
                    ]
                });
            });
        });
    }
};