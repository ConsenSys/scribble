import { ContractDefinition } from "solc-typed-ast";
import { assert } from "../../util";
import { SNode, SType, SUserFunctionDefinition } from "../ast";

export type TypeMap = Map<SNode, SType>;

/**
 * `TypeEnv` holds any typing environment information computed during the
 * typechecking process.
 */
export class TypeEnv {
    private typeMap: TypeMap;
    private userFunctions: Map<ContractDefinition, Map<string, SUserFunctionDefinition>>;

    constructor() {
        this.typeMap = new Map();
        this.userFunctions = new Map();
    }

    hasType(node: SNode): boolean {
        return this.typeMap.has(node);
    }

    typeOf(node: SNode): SType {
        const res = this.typeMap.get(node);
        assert(res !== undefined, `Missing type for ${node.pp()}`);

        return res;
    }

    define(node: SNode, typ: SType): void {
        this.typeMap.set(node, typ);
    }

    getUserFunction(scope: ContractDefinition, name: string): SUserFunctionDefinition | undefined {
        for (const base of scope.vLinearizedBaseContracts) {
            const funM = this.userFunctions.get(base);

            if (!funM) {
                continue;
            }

            const res = funM.get(name);

            if (res) {
                return res;
            }
        }

        return undefined;
    }

    defineUserFunction(scope: ContractDefinition, fun: SUserFunctionDefinition): void {
        let funM = this.userFunctions.get(scope);

        if (!funM) {
            funM = new Map();
        }

        funM.set(fun.name.name, fun);
        this.userFunctions.set(scope, funM);
    }
}
