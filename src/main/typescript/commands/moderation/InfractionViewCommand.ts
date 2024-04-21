import { TakesArgument } from "@framework/arguments/ArgumentTypes";
import IntegerArgument from "@framework/arguments/IntegerArgument";
import { ErrorType } from "@framework/arguments/InvalidArgumentError";
import { Command, CommandMessage } from "@framework/commands/Command";
import Context from "@framework/commands/Context";
import { Inject } from "@framework/container/Inject";
import { userInfo } from "@framework/utils/embeds";
import { fetchUser } from "@framework/utils/entities";
import { Colors } from "@main/constants/Colors";
import InfractionManager from "@main/services/InfractionManager";
import PermissionManagerService from "@main/services/PermissionManagerService";
import { Infraction } from "@prisma/client";
import { APIEmbed, User, italic, time } from "discord.js";

type InfractionViewCommandArgs = {
    id: number;
};

@TakesArgument<InfractionViewCommandArgs>({
    names: ["id"],
    types: [IntegerArgument],
    optional: false,
    errorMessages: [
        {
            [ErrorType.InvalidType]: "Invalid infraction ID provided.",
            [ErrorType.Required]: "Infraction ID is required."
        }
    ],
    interactionName: "id",
    interactionType: IntegerArgument
})
class InfractionViewCommand extends Command {
    public override readonly name = "infraction::view";
    public override readonly description: string = "View an infraction.";

    @Inject()
    protected readonly infractionManager!: InfractionManager;

    @Inject()
    protected readonly permissionManager!: PermissionManagerService;

    public static buildEmbed(
        infraction: Infraction,
        user: User | string,
        moderator: User | string,
        footerText: string
    ) {
        const fields = [
            {
                name: "Type",
                value: infraction.type
                    .split("_")
                    .map(s => s[0].toUpperCase() + s.slice(1).toLowerCase())
                    .join(" ")
            },
            {
                name: "User",
                value: typeof user === "string" ? `ID: ${user}` : userInfo(user),
                inline: true
            },
            {
                name: "Moderator",
                value: typeof moderator === "string" ? `ID: ${moderator}` : userInfo(moderator),
                inline: true
            },
            {
                name: "Reason",
                value: infraction.reason ?? italic("No reason provided")
            },
            {
                name: "Created At",
                value: time(infraction.createdAt, "R"),
                inline: true
            },
            {
                name: "Updated At",
                value: time(infraction.updatedAt, "R"),
                inline: true
            }
        ];

        if (infraction.expiresAt) {
            fields.push({
                name: "Expires At",
                value: time(infraction.expiresAt, "R"),
                inline: true
            });
        }

        fields.push({
            name: "Notification Status",
            value: infraction.deliveryStatus
                .split("_")
                .map(s => s[0].toUpperCase() + s.slice(1).toLowerCase())
                .join(" ")
        });

        return {
            title: `Infraction #${infraction.id}`,
            author:
                typeof user === "object"
                    ? {
                          name: user.username,
                          icon_url: user.displayAvatarURL()
                      }
                    : undefined,
            thumbnail:
                typeof user === "object"
                    ? {
                          url: user.displayAvatarURL()
                      }
                    : undefined,
            fields,
            color: Colors.Primary,
            timestamp: new Date().toISOString(),
            footer: {
                text: footerText
            }
        } as APIEmbed;
    }

    public override async execute(
        context: Context<CommandMessage>,
        args: InfractionViewCommandArgs
    ): Promise<void> {
        await context.defer({
            ephemeral: true
        });

        const infraction: Infraction | null = await this.infractionManager.getById(args.id);

        if (!infraction) {
            await context.error("No infraction found with that ID.");
            return;
        }

        const user = await fetchUser(this.application.client, infraction.userId);
        const moderator = await fetchUser(this.application.client, infraction.moderatorId);

        const embed = InfractionViewCommand.buildEmbed(
            infraction,
            user ?? infraction.userId,
            moderator ?? infraction.moderatorId,
            infraction.id.toString()
        );

        await context.reply({ embeds: [embed] });
    }
}

export default InfractionViewCommand;
