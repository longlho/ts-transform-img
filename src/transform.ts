import * as ts from "typescript";
import { resolve, dirname, extname, basename } from "path";
import { readFileSync } from "fs";

export type GenerateScopedNameFn = (
  name: string,
  filepath: string,
  css: string
) => string;

/**
 * Options
 *
 * @export
 * @interface Opts
 */
export interface Opts {
  /**
   * Generate URL for imgs that are above the threshold
   * @param filePath absolute path to img file from the import source file path
   */
  generateFilePath(filePath: string): string;
  /**
   * Threshold of img that will be inlined
   */
  threshold?: number;
}

const DEFAULT_OPTS: Opts = {
  threshold: 1e4,
  generateFilePath(filePath) {
    return filePath;
  }
};

const IMG_EXTENSION_REGEX = /\.gif|\.png|\.jpg|\.jpeg['"]$/;

function visitor(
  ctx: ts.TransformationContext,
  sf: ts.SourceFile,
  opts: Opts = DEFAULT_OPTS
) {
  opts = { ...DEFAULT_OPTS, ...opts };
  const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
    let imgPath: string;
    let namespaceImport: ts.NamespaceImport;
    if (
      !ts.isImportDeclaration(node) ||
      !node.importClause ||
      !node.importClause.namedBindings ||
      !ts.isNamespaceImport(
        (namespaceImport = node.importClause
          .namedBindings as ts.NamespaceImport)
      ) ||
      !IMG_EXTENSION_REGEX.test((imgPath = node.moduleSpecifier.getText(sf)))
    ) {
      return ts.visitEachChild(node, visitor, ctx);
    }

    // Bc cssPath includes ' or "
    imgPath = imgPath.replace(/["'"]/g, "");

    if (imgPath.startsWith(".")) {
      const sourcePath = sf.fileName;
      imgPath = resolve(dirname(sourcePath), imgPath);
    }

    const contentStr = readFileSync(imgPath).toString("base64");
    const ext = extname(imgPath).substr(1);
    const { threshold, generateFilePath } = opts;
    let content: string;
    // Embeds everything that's less than threshold
    // Bug in typedefs where byteLength only takes string
    if (Buffer.byteLength(contentStr) > threshold) {
      content = generateFilePath(resolve(basename(sf.fileName), imgPath));
    } else {
      content = `data:image/${ext};base64,${contentStr}`;
    }

    // This is the "foo" from "import * as foo from 'foo.css'"
    const importVar = namespaceImport.name.getText(sf);

    return ts.createVariableStatement(
      undefined,
      ts.createVariableDeclarationList(
        ts.createNodeArray([
          ts.createVariableDeclaration(
            importVar,
            undefined,
            ts.createLiteral(content)
          )
        ])
      )
    );
  };

  return visitor;
}

export default function(opts?: Opts) {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf, opts));
  };
}
