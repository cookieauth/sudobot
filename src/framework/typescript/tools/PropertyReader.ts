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

import type { z } from "zod";
import type { FileResolvable } from "../io/File";
import { File } from "../io/File";
import PropertySyntaxError from "./PropertySyntaxError";

type Schema = z.ZodObject<Record<string, z.ZodType<unknown>>>;

/**
 * Reads key-value pairs from a ".properties" file.
 *
 * The file should contain properties in the format:
 *
 *    key1=value1
 *    key2=value2
 *
 * Empty lines and lines starting with "#" are ignored.
 *
 * The values are parsed as follows:
 *
 * - "true" and "false" are parsed as booleans.
 * - Numbers are parsed as integers. The base can be specified using the prefixes:
 * - "0x" for hexadecimal.
 * - "0o" for octal.
 * - "0b" for binary.
 * - Otherwise, the number is parsed as decimal.
 * - Other values are parsed as strings.
 *
 * The properties can be nested using dots:
 *
 *   key1.subkey1=value1
 *   key1.subkey2=value2
 *
 * The properties can be parsed using a zod schema as well.
 *
 * @since 9.0.0
 * @category Tools
 */
class PropertyReader {
    /**
     * Creates a new properties reader.
     *
     * @param fileResolvable The file to read the properties from.
     */
    public constructor(private readonly fileResolvable: FileResolvable) {}

    /**
     * Reads the properties from the file as plain key-value pairs.
     *
     * @returns {Promise<Record<string, string>>} The properties as plain key-value pairs.
     */
    public async readPlain(): Promise<Record<string, string>> {
        using file = new File(this.fileResolvable);
        const lines = await file.readLines();
        const plainProperties: Record<string, string> = {};

        for await (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.length === 0 || trimmed.startsWith("#")) {
                continue;
            }

            const [key, value] = trimmed.split("=");

            if (value === undefined) {
                throw new PropertySyntaxError(`Invalid property syntax:\n\t${line}`);
            }

            let finalValue = value.trim();
            const startingQuote = finalValue.startsWith('"')
                ? '"'
                : finalValue.startsWith("'")
                  ? "'"
                  : "";
            const endingQuote = finalValue.endsWith('"')
                ? '"'
                : finalValue.endsWith("'")
                  ? "'"
                  : "";

            if (startingQuote !== "" && !finalValue.endsWith(startingQuote)) {
                throw new PropertySyntaxError(`Unterminated string:\n\t${line}`);
            }

            if (endingQuote !== "" && !finalValue.startsWith(endingQuote)) {
                throw new PropertySyntaxError(`Invalid string start:\n\t${line}`);
            }

            if (startingQuote !== "" && endingQuote !== "" && startingQuote !== endingQuote) {
                throw new PropertySyntaxError(`Mismatched quotes:\n\t${line}`);
            }

            finalValue = startingQuote !== "" ? finalValue.slice(1, -1) : finalValue;
            plainProperties[key.trim()] = finalValue;
        }

        return plainProperties;
    }

    /**
     * Reads the properties from the file.
     *
     * @param schema The schema to parse the properties with.
     * @returns {Promise<Record<string, unknown>>} The properties.
     */
    public async read<T extends Schema | undefined = undefined>(
        schema?: T
    ): Promise<Properties<T>> {
        const plainProperties = await this.readPlain();
        const properties: Record<string, unknown> = {};

        for (const key in plainProperties) {
            const value = plainProperties[key];
            this.set(properties, key, this.parseValue(value));
        }

        return (schema ? schema.parse(properties) : properties) as Properties<T>;
    }

    private set(object: object, key: string, value: unknown) {
        if (!key.includes(".")) {
            object[key as keyof typeof object] = value as never;
            return;
        }

        const parts = key.split(".") as (keyof typeof object)[];
        const last = parts.pop()!;

        for (const part of parts) {
            if (object[part] === undefined) {
                object[part] = {} as never;
            }

            object = object[part];
        }

        object[last] = value as never;
    }

    private parseValue(value: string): unknown {
        if (value === "true") {
            return true;
        }

        if (value === "false") {
            return false;
        }

        if (/^(0(x|o|b))?[0-9A-Fa-f]+$/.test(value)) {
            const base = value.startsWith("0x")
                ? 16
                : value.startsWith("0o")
                  ? 8
                  : value.startsWith("0b")
                    ? 2
                    : 10;

            const number = parseInt(base === 10 ? value : value.slice(2), base);

            if (isNaN(number)) {
                throw new PropertySyntaxError(`Invalid number: ${value}`);
            }

            return number;
        }

        return value;
    }
}

export type Properties<T extends Schema | undefined = undefined> = T extends undefined
    ? Record<string, unknown>
    : z.infer<Exclude<T, undefined>>;

export default PropertyReader;
