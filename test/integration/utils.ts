import fse from "fs-extra";
import path from "path";
import {
    SourceUnit,
    VersionDetectionStrategy,
    LatestVersionInEachSeriesStrategy,
    CompileFailure,
    createFileSystemImportFinder,
    compile,
    detectCompileErrors,
    ASTReader,
    ContractDefinition,
    FunctionDefinition,
    ASTNode
} from "solc-typed-ast";
import { spawnSync } from "child_process";
import { assert } from "../../src";

export function searchRecursive(directory: string, pattern: RegExp): string[] {
    let results: string[] = [];

    fse.readdirSync(directory).forEach((entry: string) => {
        const resolvedEntry = path.resolve(directory, entry);
        const stat = fse.statSync(resolvedEntry);

        if (stat.isDirectory()) {
            results = results.concat(searchRecursive(resolvedEntry, pattern));
        }

        if (stat.isFile() && pattern.test(resolvedEntry)) {
            results.push(resolvedEntry);
        }
    });

    return results;
}

export function toAst(
    fileName: string,
    content: string
): [SourceUnit[], ASTReader, Map<string, string>, string] {
    const files = new Map<string, string>();
    const strategy = new VersionDetectionStrategy(content, new LatestVersionInEachSeriesStrategy());

    files.set(fileName, content);

    const failures: CompileFailure[] = [];

    for (const compilerVersion of strategy.select()) {
        const finder = createFileSystemImportFinder(fileName, files, []);
        const data = compile(fileName, content, compilerVersion, finder, []);
        const errors = detectCompileErrors(data);

        if (errors.length === 0) {
            const reader = new ASTReader();

            return [reader.read(data), reader, files, compilerVersion];
        }

        failures.push({ compilerVersion, errors });
    }

    if (failures.length === 0) {
        throw new Error("Unexpected empty compiler failures array");
    }

    const message = [
        "Compiler failures detected:",
        ...failures.map(
            ({ compilerVersion, errors }) => compilerVersion + ":\n" + errors.join("\n")
        )
    ].join("\n");

    throw new Error(message);
}

export function scribble(fileName: string | string[], ...args: string[]): string {
    // Scrub DEBUG_LEVEL and DEBUG_FILTER from subprocess environment.
    const scrubbedEnv = Object.entries(process.env)
        .filter(([name]) => name !== "DEBUG_LEVEL" && name !== "DEBUG_FILTER")
        .reduce((env, [key, val]) => {
            env[key] = val as string;
            return env;
        }, {} as { [key: string]: string });

    const processArgs = (fileName instanceof Array ? fileName : [fileName]).concat(args);
    const result = spawnSync("scribble", processArgs, {
        encoding: "utf8",
        env: scrubbedEnv
    });

    if (result.stderr) {
        throw new Error(result.stderr);
    }

    if (result.status !== 0) {
        throw new Error(`Non-zero exit code: ${result.status}`);
    }

    return result.stdout;
}

export function findContract(name: string, sources: SourceUnit[]): ContractDefinition {
    for (const unit of sources) {
        for (const contract of unit.vContracts) {
            if (contract.name === name) {
                return contract;
            }
        }
    }
    throw new Error(``);
}

export function findFunction(name: string, contract: ContractDefinition): FunctionDefinition {
    for (const fun of contract.vFunctions) {
        if (name === fun.name) {
            return fun;
        }
    }
    throw new Error(``);
}

/**
 * Helper function to check that 2 ASTNodes are (roughly) isomorphic. It checks that:
 *  1) They have the same tree structure (i.e. type of node at each branch, and number of children)
 *  2) Any string/int/bool properties on every node are the same
 *
 * @param a
 * @param b
 */
export function isomorphic(a: ASTNode, b: ASTNode): boolean {
    if (a.constructor !== b.constructor) {
        return false;
    }

    const aProps = a.getFieldValues();
    const bProps = b.getFieldValues();

    assert(
        aProps.size === bProps.size,
        `Objects of the same type should have the same number of fields`
    );

    for (const [aName, aVal] of aProps.entries()) {
        if (aName === "src" || aName === "id") continue;

        const bVal = bProps.get(aName);

        if (
            (typeof aVal === "number" ||
                typeof aVal === "string" ||
                typeof aVal === "boolean" ||
                typeof aVal === "bigint") &&
            aVal !== bVal
        ) {
            return false;
        }
    }

    const aChildren = a.children;
    const bChildren = b.children;

    if (aChildren.length !== bChildren.length) {
        return false;
    }

    for (let i = 0; i < aChildren.length; i++) {
        if (!isomorphic(aChildren[i], bChildren[i])) {
            return false;
        }
    }

    return true;
}
