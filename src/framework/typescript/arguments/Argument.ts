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

import type { Awaitable, ChatInputCommandInteraction } from "discord.js";
import type { ArgumentInterface } from "./ArgumentInterface";
import type { ArgumentTypeOptions } from "./ArgumentTypes";
import { ErrorType, InvalidArgumentError } from "./InvalidArgumentError";
import type Context from "../commands/Context";

export type Casted<T> = {
    value?: Argument<T>;
    error?: InvalidArgumentError;
};

export type ArgumentConstructor<T = unknown> = (new (
    ...args: ConstructorParameters<typeof Argument<T>>
) => Argument<T>) &
    Pick<typeof Argument<T>, "performCast" | "performCastFromInteraction">;

export default abstract class Argument<T = unknown> implements ArgumentInterface<T> {
    protected readonly commandContent: string;
    protected readonly stringValue: string;
    protected readonly argv: string[];
    protected transformedValue!: T;
    public readonly position: number;
    public readonly name?: string;
    protected readonly rules?: NonNullable<ArgumentTypeOptions["rules"]>;
    protected readonly interaction?: ChatInputCommandInteraction;
    protected isRequired = false;

    public constructor(
        protected readonly context: Context,
        commandContent: string,
        argv: string[],
        value: string,
        position: number,
        name?: string,
        rules?: NonNullable<ArgumentTypeOptions["rules"]>,
        interaction?: ChatInputCommandInteraction
    ) {
        this.commandContent = commandContent;
        this.argv = argv;
        this.stringValue = value;
        this.position = position;
        this.rules = rules;
        this.name = name;
        this.interaction = interaction;
    }

    public setRequired(isRequired: boolean) {
        this.isRequired = isRequired;
        return this;
    }

    /**
     * This method is used to validate the argument string, before transformation.
     *
     * @returns {Awaitable<boolean>} Whether the argument is valid.
     * @throws {InvalidArgumentError} If the argument is invalid.
     */
    public validate(): Awaitable<boolean> {
        return true;
    }

    public abstract toString(): string;
    protected abstract transform(): Awaitable<T>;
    protected abstract resolveFromInteraction(
        interaction: ChatInputCommandInteraction
    ): Awaitable<T>;

    public static async performCastFromInteraction(
        context: Context,
        interaction: ChatInputCommandInteraction,
        name: string,
        rules?: NonNullable<ArgumentTypeOptions["rules"]>,
        isRequired = false
    ) {
        try {
            const casted = this.castFrom(context, "", [], "", 0, name, rules, interaction).setRequired(
                isRequired
            );

            return {
                value: await casted.toTransformed()
            };
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                return {
                    error
                };
            }

            throw error;
        }
    }

    public async toTransformed() {
        this.transformedValue = this.interaction
            ? await this.resolveFromInteraction(this.interaction)
            : await this.transform();

        if (!(await this.postTransformValidation())) {
            this.error("Invalid argument received", ErrorType.InvalidType);
        }

        return this;
    }

    /**
     * This method is used to validate the argument after transformation.
     *
     * @returns {Awaitable<boolean>} Whether the argument is valid.
     * @throws {InvalidArgumentError} If the argument is invalid.
     */
    public postTransformValidation(): Awaitable<boolean> {
        return true;
    }

    public getRawValue() {
        return this.stringValue;
    }

    public getValue() {
        return this.transformedValue!;
    }

    protected error(
        message: string,
        type: ErrorType,
        ruleLike?: string | { message?: string } | undefined
    ): never {
        throw new InvalidArgumentError(
            (typeof ruleLike === "string" ? ruleLike : ruleLike?.message) ?? message,
            {
                position: this.position,
                type
            }
        );
    }

    protected attemptValidation() {
        if (this.rules?.choices?.length && !this.rules?.choices.includes(this.stringValue)) {
            return this.error(
                `Invalid choice received at position #${this.position}`,
                ErrorType.InvalidType
            );
        }

        return this.validate();
    }

    public static async performCast(
        context: Context,
        commandContent: string,
        argv: string[],
        value: string,
        position: number,
        name?: string,
        rules?: NonNullable<ArgumentTypeOptions["rules"]>,
        isRequired = false
    ): Promise<Casted<unknown>> {
        try {
            const casted = await this.castFrom(
                context,
                commandContent,
                argv,
                value,
                position,
                name,
                rules
            ).setRequired(isRequired);

            if (!casted.attemptValidation()) {
                throw new InvalidArgumentError(
                    `Invalid argument received at position #${position}`,
                    {
                        position,
                        type: ErrorType.InvalidType
                    }
                );
            }

            return {
                value: await casted.toTransformed()
            };
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                return {
                    error
                };
            }

            throw error;
        }
    }

    public static castFrom(
        context: Context,
        commandContent: string,
        argv: string[],
        value: string,
        position: number,
        name?: string,
        rules?: NonNullable<ArgumentTypeOptions["rules"]>,
        interaction?: ChatInputCommandInteraction
    ) {
        return new (this as unknown as new (
            ...args: ConstructorParameters<typeof Argument<unknown>>
        ) => Argument<unknown>)(context, commandContent, argv, value, position, name, rules, interaction);
    }
}
