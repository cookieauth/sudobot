import AbstractTask from "blazebuild/tasks/AbstractTask";
import { TaskAction } from "blazebuild/tasks/TaskAction";
import { TaskDependencyGenerator } from "blazebuild/tasks/TaskDependencyGenerator";
import { TaskInputGenerator } from "blazebuild/tasks/TaskInputGenerator";
import { TaskOutputGenerator } from "blazebuild/tasks/TaskOutputGenerator";
import type { Awaitable } from "blazebuild/types/utils";
import { glob } from "glob";
import path from "path";
import CompileTypeScriptTask from "./CompileTypeScriptTask";

class CompileTask extends AbstractTask {
    @TaskAction
    protected override async run(): Promise<void> {}

    @TaskDependencyGenerator
    protected override async dependencies() {
        return [CompileTypeScriptTask];
    }

    @TaskInputGenerator
    protected override generateInput(): Awaitable<string[]> {
        return glob(path.resolve(process.cwd(), "src/**/*.ts"));
    }

    @TaskOutputGenerator
    protected override generateOutput(): Awaitable<string[]> {
        return glob(path.resolve(process.cwd(), "build/out/**/*.js"));
    }
}

export default CompileTask;
