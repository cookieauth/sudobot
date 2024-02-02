import { Awaitable } from "discord.js";
import { Router } from "express";
import { lstat, readdir } from "node:fs/promises";
import path, { basename, dirname } from "node:path";
import Controller from "../api/Controller";
import { EventListenerInfo } from "../decorators/GatewayEventListener";
import { ClientEvents } from "../types/ClientEvents";
import { Class, DefaultExport } from "../types/Utils";
import { log, logInfo } from "../utils/logger";
import type Client from "./Client";
import Command from "./Command";
import EventListener from "./EventListener";
import Service from "./Service";

class DynamicLoader extends Service {
    protected readonly eventHandlers = new WeakMap<object, Record<keyof ClientEvents, Function[]>>();

    private async iterateDirectoryRecursively(root: string, rootArray?: string[]) {
        const filesAndDirectories = await readdir(root);
        const files: string[] = [];

        for (const file of filesAndDirectories) {
            const filepath = path.resolve(root, file);
            const stat = await lstat(filepath);

            if (stat.isDirectory()) {
                await this.iterateDirectoryRecursively(filepath, rootArray ?? files);
                continue;
            }

            (rootArray ?? files).push(filepath);
        }

        return files;
    }

    async loadControllers(router: Router) {
        const eventListenerFiles = await this.iterateDirectoryRecursively(path.resolve(__dirname, "../api/controllers"));

        for (const file of eventListenerFiles) {
            if ((!file.endsWith(".ts") && !file.endsWith(".js")) || file.endsWith(".d.ts")) {
                continue;
            }

            await this.loadController(file, router);
        }
    }

    async loadController(filepath: string, router: Router) {
        const { default: ControllerClass }: DefaultExport<Class<Controller, [Client]>> = await import(filepath);
        const controller = new ControllerClass(this.client);
        this.client.server.loadController(controller, ControllerClass, router);
        logInfo("Loaded Controller: ", ControllerClass.name);
    }

    async loadEvents() {
        const eventListenerFiles = await this.iterateDirectoryRecursively(path.resolve(__dirname, "../events"));

        for (const file of eventListenerFiles) {
            if ((!file.endsWith(".ts") && !file.endsWith(".js")) || file.endsWith(".d.ts")) {
                continue;
            }

            await this.loadEvent(file);
        }
    }

    async loadEvent(filepath: string) {
        const { default: EventListenerClass }: DefaultExport<Class<EventListener, [Client]>> = await import(filepath);
        const listener = new EventListenerClass(this.client);
        this.client.addEventListener(listener.name, listener.execute.bind(listener));
        logInfo("Loaded Event: ", listener.name);
    }

    async loadServiceFromDirectory(servicesDirectory = path.resolve(__dirname, "../services")) {
        const commandFiles = await this.iterateDirectoryRecursively(servicesDirectory);

        for (const file of commandFiles) {
            if ((!file.endsWith(".ts") && !file.endsWith(".js")) || file.endsWith(".d.ts")) {
                continue;
            }

            await this.client.serviceManager.loadService(file);
        }
    }

    async loadCommands(
        commandsDirectory = path.resolve(__dirname, "../commands"),
        loadMetadata: boolean = true,
        filter?: (path: string, name: string) => Awaitable<boolean>
    ) {
        const commandFiles = await this.iterateDirectoryRecursively(commandsDirectory);

        for (const file of commandFiles) {
            if ((!file.endsWith(".ts") && !file.endsWith(".js")) || file.endsWith(".d.ts")) {
                continue;
            }

            if (filter && !(await filter(file, path.basename(file)))) {
                continue;
            }

            await this.loadCommand(file, loadMetadata);
        }
    }

    async loadCommand(filepath: string, loadMetadata = true) {
        const { default: CommandClass }: DefaultExport<Class<Command, [Client]>> = await import(filepath);
        const command = new CommandClass(this.client);
        const previousCommand = this.client.commands.get(command.name);

        if (loadMetadata && previousCommand) {
            await this.unloadEventsFromMetadata(previousCommand);
        }

        command.group = basename(dirname(filepath));
        this.client.commands.set(command.name, command);

        for (const alias of command.aliases) {
            this.client.commands.set(alias, command);
        }

        if (loadMetadata) {
            await this.loadEventsFromMetadata(command);
        }

        logInfo("Loaded Command: ", command.name);
    }

    async loadEventsFromMetadata(object: object, accessConstructor = true) {
        const finalObject = accessConstructor ? object.constructor : object;
        const metadata =
            Symbol.metadata in finalObject
                ? (finalObject[Symbol.metadata] as { eventListeners?: EventListenerInfo[] })
                : {
                      eventListeners: Reflect.getMetadata("event_listeners", (finalObject as any).prototype)
                  };

        const handlerData = this.eventHandlers.get(object) ?? ({} as Record<keyof ClientEvents, Function[]>);

        for (const listenerInfo of metadata.eventListeners ?? []) {
            const callback = object[listenerInfo.methodName as unknown as keyof typeof object] as Function;
            const handler = callback.bind(object);
            handlerData[listenerInfo.event as keyof typeof handlerData] ??= [] as Function[];
            handlerData[listenerInfo.event as keyof typeof handlerData].push(handler);

            this.client.addEventListener(listenerInfo.event as keyof ClientEvents, handler);
        }

        this.eventHandlers.set(object, handlerData);

        if (metadata.eventListeners) {
            log(`Registered ${metadata.eventListeners?.length ?? 0} event listeners`);
        }
    }

    async unloadEventsFromMetadata(object: object) {
        const handlerData = this.eventHandlers.get(object) ?? ({} as Record<keyof ClientEvents, Function[]>);
        let count = 0;

        for (const event in handlerData) {
            for (const callback of handlerData[event as keyof typeof handlerData]) {
                this.client.removeEventListener(
                    event as keyof ClientEvents,
                    callback as (...args: ClientEvents[keyof ClientEvents]) => any
                );
            }

            count += handlerData[event as keyof typeof handlerData].length;
        }

        log(`Unloaded ${count} event listeners`);
    }
}

export default DynamicLoader;
