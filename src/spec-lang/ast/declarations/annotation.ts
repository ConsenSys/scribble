import { Range, SNode } from "../node";
export enum AnnotationType {
    IfSucceeds = "if_succeeds",
    Invariant = "invariant",
    Define = "define"
}

export abstract class SAnnotation extends SNode {
    public readonly type: AnnotationType;
    public readonly label?: string;
    constructor(type: AnnotationType, label?: string, src?: Range) {
        super(src);
        this.type = type;
        this.label = label;
    }
}
