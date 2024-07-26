import { ArgumentSchema } from "@framework/arguments/ArgumentTypes";
import GuildMemberArgument from "@framework/arguments/GuildMemberArgument";
import UserArgument from "@framework/arguments/UserArgument";
import type { Buildable } from "@framework/commands/Command";
import { Command } from "@framework/commands/Command";
import type Context from "@framework/commands/Context";
import { Inject } from "@framework/container/Inject";
import { emoji } from "@framework/utils/emoji";
import { getUserBadges } from "@framework/utils/user";
import PermissionManagerService from "@main/services/PermissionManagerService";
import {
    ActivityType,
    APIEmbedField,
    bold,
    EmbedBuilder,
    Emoji,
    GuildMember,
    PermissionFlagsBits,
    PermissionsBitField,
    Role,
    roleMention,
    time,
    User
} from "discord.js";

type ProfileCommandArgs = {
    member: GuildMember | User;
};

@ArgumentSchema.Definition({
    names: ["member", "member"],
    types: [GuildMemberArgument<true>, UserArgument<true>],
    optional: true,
    errorMessages: [GuildMemberArgument.defaultErrors, UserArgument.defaultErrors]
})
class ProfileCommand extends Command {
    private static readonly MAX_PERMISSION_COUNT = PermissionsBitField.All.toString(2).length;
    public override readonly name = "profile";
    public override readonly description: string = "Shows information about your profile.";
    public override readonly defer = true;
    public override readonly usage = ["[user: GuildMember | User]"];

    @Inject()
    private readonly permissionManagerService!: PermissionManagerService;

    public override build(): Buildable[] {
        return [
            this.buildChatInput().addUserOption(option =>
                option
                    .setName("member")
                    .setDescription(
                        "The member to show the profile of. If not provided, it will show your profile."
                    )
            )
        ];
    }

    private isAvailableEmoji({ id, identifier }: Emoji) {
        for (const [, guild] of this.application.client.guilds.cache) {
            const emoji = guild.emojis.cache.find(e => e.id === id || e.identifier === identifier);

            if (emoji) {
                return true;
            }
        }

        return false;
    }

    private status(s: "idle" | "online" | "dnd" | "invisible" | null | undefined): string {
        if (s === "idle") {
            return "Idle";
        } else if (s === "dnd") {
            return "Do not disturb";
        } else if (s === "online") {
            return "Online";
        } else if (s === undefined || s === null || s === "invisible") {
            return "Offline/Invisible";
        }

        return s;
    }

    private statusEmoji(
        context: Context,
        s: "idle" | "online" | "dnd" | "invisible" | null | undefined
    ): string {
        if (s === "idle") {
            return context.emoji("idle")?.toString() ?? "";
        } else if (s === "dnd") {
            return context.emoji("dnd")?.toString() ?? "";
        } else if (s === "online") {
            return context.emoji("online")?.toString() ?? "";
        } else if (s === undefined || s === null || s === "invisible") {
            return context.emoji("invisible")?.toString() ?? "";
        }
        return s;
    }

    private getStatusText(context: Context, member: GuildMember) {
        let str = "";

        if (member.presence?.clientStatus?.desktop) {
            str +=
                this.statusEmoji(context, member.presence.clientStatus.desktop) +
                " **Desktop** (" +
                this.status(member?.presence?.clientStatus?.desktop) +
                ")\n";
        }

        if (member.presence?.clientStatus?.web) {
            str +=
                this.statusEmoji(context, member.presence.clientStatus.web) +
                " **Web** (" +
                this.status(member.presence.clientStatus.web) +
                ")\n";
        }

        if (member.presence?.clientStatus?.mobile) {
            str +=
                this.statusEmoji(context, member.presence.clientStatus.mobile) +
                " **Mobile** (" +
                this.status(member.presence.clientStatus.mobile) +
                ")";
        }

        return str;
    }

    private calculatePermissionPercentage(member: GuildMember): number {
        if (
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            member.guild.ownerId === member.id
        ) {
            return 100;
        }

        const count = member.permissions.bitfield.toString(2).length;
        return (count / ProfileCommand.MAX_PERMISSION_COUNT) * 100;
    }

    private async getMemberNameBadge(_member: GuildMember | undefined, isSystemAdmin: boolean) {
        let badges = "";

        if (isSystemAdmin) {
            badges += `${emoji(this.application.client, "staff1") ?? ""}${emoji(this.application.client, "staff2") ?? ""}`;
        }

        return badges.trim();
    }

    private async getMemberDescriptiveBadges(
        member: GuildMember | undefined,
        isSystemAdmin: boolean
    ) {
        const badges = [];

        if (isSystemAdmin) {
            badges.push(
                `${emoji(this.application.client, "sysadmin") ?? ""} System Staff/Administrator`
            );
        }

        if (member) {
            if (await this.permissionManagerService.isModerator(member)) {
                badges.push(
                    `${emoji(this.application.client, "moderator") ?? ""} Server Moderator`
                );
            }
        }

        return badges;
    }

    public override async execute(context: Context, args: ProfileCommandArgs): Promise<void> {
        const member = args.member ?? context.member ?? context.user;
        const isMember = member instanceof GuildMember;
        const user = isMember ? member.user : member;
        const activities: string[] = [];

        if (isMember && member?.presence) {
            for (const activity of member?.presence?.activities.values() ?? []) {
                if (activity.type === ActivityType.Custom) {
                    activities.push(
                        `${activity.emoji && this.isAvailableEmoji(activity.emoji) ? `${activity.emoji.toString()}` : ":notepad_spiral:"} **|** ${
                            activity.state
                        }`
                    );
                } else if (activity.type === ActivityType.Listening) {
                    if (activity.name === "Spotify") {
                        const url = activity.url
                            ? `${activity.url}`
                            : activity.syncId
                              ? `https://open.spotify.com/track/${encodeURIComponent(activity.syncId)}`
                              : null;

                        activities.push(
                            `${context.emoji("spotify")} **|** Listening to **Spotify**: ${url ? "[" : "__"}${activity.state?.split(/;/)[0]} - ${
                                activity.details
                            }${url ? "](" + url + ")" : "__"}`
                        );
                        continue;
                    }

                    activities.push(`:musical_note: **|** Listening to **${activity.name}**`);
                } else if (activity.type === ActivityType.Competing) {
                    activities.push(`:fire: **|** Competing **${activity.name}**`);
                } else if (activity.type === ActivityType.Playing) {
                    activities.push(`:video_game: **|** Playing **${activity.name}**`);
                } else if (activity.type === ActivityType.Streaming) {
                    activities.push(`:video_camera: **|** Streaming **${activity.name}**`);
                } else if (activity.type === ActivityType.Watching) {
                    activities.push(`:tv: **|** Watching **${activity.name}**`);
                }
            }
        }
        const orderedRoles = isMember
            ? [...member!.roles.cache.values()]
                  .filter(role => role.id !== context.guildId)
                  .sort((role1, role2) => {
                      return role2.position - role1.position;
                  })
            : null;
        const limit = 10;
        const roles = (
            isMember
                ? orderedRoles!.length > limit
                    ? orderedRoles!.slice(0, limit)
                    : orderedRoles
                : ([] as Role[])
        )!
            .reduce((acc, value) => `${acc} ${roleMention(value.id)}`, "")!
            .trim()!;
        const statusText = isMember ? this.getStatusText(context, member!) : null;
        const isSystemAdmin =
            this.application
                .service("configManager")
                .systemConfig.system_admins.includes(user.id) ||
            (member &&
                member instanceof GuildMember &&
                (await this.permissionManagerService.isSystemAdmin(member)));
        const nameBadges = user!.displayName
            ? " " +
              (await this.getMemberNameBadge(
                  member instanceof GuildMember ? member : undefined,
                  isSystemAdmin
              ))
            : "";

        const fields: APIEmbedField[] = [
            ...(isMember
                ? [
                      {
                          name: "Nickname",
                          value: `${member!.nickname?.replace(/\*<>@_~\|/g, "") ?? "*Nickname is not set*"}`
                      }
                  ]
                : []),
            {
                name: "Display Name",
                value: `${user!.displayName ? user!.displayName.replace(/\*<>@_~\|/g, "") + nameBadges : "*Display name is not set*"}`
            },
            {
                name: "Account Created",
                value: `${user.createdAt.toLocaleDateString("en-US")} (${time(user.createdAt, "R")})`,
                inline: true
            },
            ...(isMember
                ? [
                      {
                          name: "Joined at",
                          value: `${member!.joinedAt!.toLocaleDateString("en-US")} (${time(
                              member!.joinedAt!,
                              "R"
                          )})`,
                          inline: true
                      },
                      {
                          name: "Active Devices",
                          value: `${statusText === "" ? `${context.emoji("invisible")} Offline/Invisible` : statusText}`
                      },
                      {
                          name: "Status",
                          value: `${activities.length === 0 ? "*No status set*" : activities.join("\n")}`
                      },
                      {
                          name: "Roles",
                          value:
                              roles === ""
                                  ? "*No roles assigned*"
                                  : `${roles} ${orderedRoles!.length > limit ? `**+ ${orderedRoles!.length - limit} More**` : ""}`
                      }
                  ]
                : [])
        ];

        const badges = [
            ...getUserBadges(user),
            ...(await this.getMemberDescriptiveBadges(
                isMember ? (member as GuildMember) : undefined,
                isSystemAdmin
            ))
        ];

        if (badges.length > 0) {
            fields.push({
                name: "Badges",
                value: badges.map(b => bold(b)).join("\n")
            });
        }

        let banner: string | undefined;

        try {
            await user.fetch(true);
            banner = user!.bannerURL({ size: 4096, forceStatic: false }) ?? undefined;
        } catch (e) {
            this.application.logger.debug(e);
        }

        await context.replyEmbed(
            new EmbedBuilder({
                image: banner
                    ? {
                          url: banner
                      }
                    : undefined
            })
                .setColor(user!.hexAccentColor ? user!.hexAccentColor! : "#007bff")
                .setAuthor({
                    name: user.tag!,
                    iconURL: user.displayAvatarURL()
                })
                .setThumbnail(
                    (isMember ? member : user).displayAvatarURL({
                        size: 4096,
                        forceStatic: false
                    })
                )
                .setFields(fields)
                .setFooter({
                    text:
                        `${user.bot ? "Bot" : "User"} • ${member!.id}` +
                        (isMember
                            ? ` • Has ${this.calculatePermissionPercentage(member)}% permissions`
                            : "")
                })
        );
    }
}

export default ProfileCommand;
