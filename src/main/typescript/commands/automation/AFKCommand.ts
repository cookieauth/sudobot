import { ArgumentSchema } from "@framework/arguments/ArgumentTypes";
import { ErrorType } from "@framework/arguments/InvalidArgumentError";
import RestStringArgument from "@framework/arguments/RestStringArgument";
import type { Buildable } from "@framework/commands/Command";
import { Command } from "@framework/commands/Command";
import type Context from "@framework/commands/Context";
import { Inject } from "@framework/container/Inject";
import RuleModerationService from "@main/automod/RuleModerationService";
import { Colors } from "@main/constants/Colors";
import { MessageRuleScope } from "@main/contracts/ModerationRuleHandlerContract";
import AFKService from "@main/services/AFKService";
import { ChatInputCommandInteraction, Collection, Message } from "discord.js";

type AFKCommandArgs = {
    reason?: string;
};

@ArgumentSchema.Overload([
    {
        names: ["reason"],
        types: [RestStringArgument],
        optional: true,
        errorMessages: [
            {
                [ErrorType.InvalidRange]: "The reason must be between 1 and 1024 characters long."
            }
        ],
        rules: [
            {
                "range:max": 1024,
                "range:min": 1
            }
        ],
        interactionName: "reason",
        interactionType: RestStringArgument
    }
])
class AFKCommand extends Command {
    public override readonly name = "afk";
    public override readonly description: string = "Sets your AFK status.";
    public override readonly detailedDescription: string =
        "Sets your AFK status. If you provide a reason, it will be displayed when someone mentions you.";
    public override readonly defer = true;
    public override readonly usage = ["[...reason: RestString]"];
    public override readonly aliases = ["gafk"];

    @Inject()
    private readonly afkService!: AFKService;

    @Inject()
    private readonly ruleModerationService!: RuleModerationService;

    public override build(): Buildable[] {
        return [
            this.buildChatInput()
                .addStringOption(option =>
                    option
                        .setName("reason")
                        .setDescription("The reason you are AFK.")
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName("global")
                        .setDescription("Whether to set your AFK status globally.")
                        .setRequired(false)
                )
        ];
    }

    private async verifyReason(
        context: Context<Message<true> | ChatInputCommandInteraction>,
        reason?: string
    ): Promise<boolean> {
        return !(await this.ruleModerationService.moderate(
            {
                components: [],
                author: context.user,
                attachments: new Collection(),
                applicationId: null,
                _cacheType: true,
                bulkDeletable: false,
                channel: context.channel,
                channelId: context.channel.id,
                client: this.application.client,
                content: reason ?? "",
                embeds: [],
                guild: context.guild,
                guildId: context.guild?.id,
                id: "",
                member: context.member,
                mentions: {
                    channels: new Collection(),
                    everyone: false,
                    members: new Collection(),
                    roles: new Collection(),
                    users: new Collection()
                }
            } as unknown as Message,
            {
                scopes: [MessageRuleScope.Content],
                skipActions: true
            }
        ));
    }

    public override async execute(
        context: Context<Message<true> | ChatInputCommandInteraction>,
        args: AFKCommandArgs
    ): Promise<void> {
        const isGlobal =
            (context.isLegacy()
                ? context.commandName === "gafk"
                : context.isChatInput()
                  ? context.options.getBoolean("global")
                  : null) ?? false;

        if (this.afkService.isAFK(context.user.id, isGlobal ? "global" : context.guild.id)) {
            const global = this.afkService.getAFK(context.user.id, "global");
            const guild = this.afkService.getAFK(context.user.id, context.guild.id);

            await this.afkService.removeAFK(
                context.user.id,
                isGlobal ? "global" : context.guild.id
            );
            await context.reply({
                embeds: [
                    {
                        description: this.afkService.generateAFKSummary(global, guild!),
                        color: Colors.Primary
                    }
                ]
            });

            return;
        }

        const switchContext = this.afkService.isAFK(
            context.user.id,
            isGlobal ? context.guild.id : "global"
        );

        if (switchContext) {
            await this.afkService.switchContext(
                context.user.id,
                isGlobal ? "global" : context.guild.id
            );

            await context.reply(
                `Switched your AFK context to ${isGlobal ? "global" : "this server"}.`
            );

            return;
        }

        if (!(await this.verifyReason(context, args.reason))) {
            return void context.error("Your AFK reason violates this server's rules.");
        }

        await this.afkService.setAFK({
            userId: context.user.id,
            guildId: isGlobal ? "global" : context.guild.id,
            reason: args.reason
        });

        await context.reply({
            embeds: [
                {
                    description: `You are AFK now${args.reason ? ` with the reason: ${args.reason}` : ""}.`,
                    color: Colors.Primary
                }
            ]
        });
    }
}

export default AFKCommand;
