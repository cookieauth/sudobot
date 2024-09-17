/*
* This file is part of SudoBot.
*
* Copyright (C) 2021-2024 OSN Developers.
*
* SudoBot is free software; you can redistribute it and/or modify it
* under the terms of the GNU Affero General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* SudoBot is distributed in the hope that it will be useful, but
* WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with SudoBot. If not, see <https://www.gnu.org/licenses/>.
*/

import { ArgumentSchema } from "@framework/arguments/ArgumentTypes";
import ChannelArgument from "@framework/arguments/ChannelArgument";
import type { Buildable } from "@framework/commands/Command";
import { Command } from "@framework/commands/Command";
import type Context from "@framework/commands/Context";
import { Inject } from "@framework/container/Inject";
import { PermissionFlags } from "@framework/permissions/PermissionFlag";
import ChannelLockManager from "@main/services/ChannelLockManager";
import { ChannelType, GuildBasedChannel, PermissionFlagsBits } from "discord.js";

type LockCommandArgs = {
    channel?: GuildBasedChannel;
};

@ArgumentSchema.Definition({
    names: ["channel"],
    types: [ChannelArgument<true>],
    optional: true,
    errorMessages: [ChannelArgument.defaultErrors],
    interactionName: "channel",
    interactionType: ChannelArgument<true>
})
class LockCommand extends Command {
    public override readonly name = "lock";
    public override readonly description: string = "Locks a channel.";
    public override readonly detailedDescription: string =
        "Locks a channel, by removing @everyone permission for Send Messages.";
    public override readonly defer = true;
    public override readonly usage = ["[channel]"];
    public override readonly permissions = [PermissionFlags.ManageChannels];
    public override readonly systemPermissions = [PermissionFlagsBits.ManageChannels];

    @Inject()
    private readonly channelLockManager!: ChannelLockManager;

    public override build(): Buildable[] {
        return [
            this.buildChatInput().addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("The channel to lock. Defaults to the current channel.")
                    .addChannelTypes(
                        ChannelType.GuildAnnouncement,
                        ChannelType.GuildCategory,
                        ChannelType.GuildText,
                        ChannelType.GuildVoice,
                        ChannelType.GuildForum,
                        ChannelType.GuildStageVoice
                    )
            )
        ];
    }

    public override async execute(context: Context, args: LockCommandArgs): Promise<void> {
        const channel = args.channel ?? context.channel;

        if (channel.isThread()) {
            await context.error("You cannot lock a thread.");
            return;
        }

        const result = await this.channelLockManager.lock(channel);

        if (result.status === "error") {
            return void context.error(`${result.message}.`);
        }

        if (context.isChatInput()) {
            await context.success(`Channel ${channel} has been locked.`);
        } else if (context.isLegacy()) {
            await context.commandMessage.react(context.emoji("check")?.toString() || "✅");
        }

        if ("send" in channel) {
            channel
                .send(":lock: This channel has been locked.")
                .catch(this.application.logger.error);
        }
    }
}

export default LockCommand;
