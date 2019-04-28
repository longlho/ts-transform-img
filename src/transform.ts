import * as ts from "typescript";
import { resolve, dirname, extname, basename } from "path";
import { readFileSync } from "fs";

export type InterpolateNameFn = (sourceFileName: string, imgPath: string) => string

/**
 * Options
 *
 * @export
 * @interface Opts
 */
export interface Opts {
  /**
   * Threshold of img that will be inlined
   */
  threshold?: number;
  /**
   * Callback that gets triggered every time we encounter
   * an img import
   * @param params 
   */
  onImgExtracted (params: { imgPath: string, srcFilePath: string}): void
  /**
   * webpack-style name interpolation
   *
   * @type {(InterpolateNameFn | string)}
   * @memberof Opts
   */
  interpolateName?: InterpolateNameFn | string
}

const DEFAULT_OPTS: Opts = {
  threshold: 1e4,
  onImgExtracted(){}
};

const IMG_EXTENSION_REGEX = /\.gif|\.png|\.jpg|\.jpeg['"]$/;

function visitor(
  ctx: ts.TransformationContext,
  sf: ts.SourceFile,
  opts: Opts = DEFAULT_OPTS
) {
  opts = { ...DEFAULT_OPTS, ...opts };
  const {onImgExtracted, threshold} = opts
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

    const contentStr = readFileSync(imgPath);
    const ext = extname(imgPath).substr(1);
    let content: string;
    // Embeds everything that's less than threshold
    if (Buffer.byteLength(contentStr) > threshold) {
      const imgAbsolutePath = resolve(basename(sf.fileName), imgPath)
      onImgExtracted({imgPath: imgAbsolutePath, srcFilePath: sf.fileName})
      // If falsy content, don't transform the node
      if (!content) {
        return ts.visitEachChild(node, visitor, ctx)
      }
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
