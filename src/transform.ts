import * as ts from 'typescript'
import { resolve, dirname, extname, basename } from 'path'
import { readFileSync } from 'fs'
import { getHashDigest } from 'loader-utils'

export type GenerateScopedNameFn = (name: string, filepath: string, css: string) => string

/**
 * Primarily from https://github.com/css-modules/css-modules-require-hook
 *
 * @export
 * @interface Opts
 */
export interface Opts {
    generateFilePath?(filename: string): string
    threshold?: number
}

function generateImgPath(filename: string) {
    const hash = getHashDigest(readFileSync(filename), 'md5', 'hex')
    const ext = extname(filename)
    return `${basename(filename, ext)}.${hash}${ext}`
}

const IMG_EXTENSION_REGEX = /\.png|\.jpg|\.jpeg['"]$/

function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile, opts: Opts = {}) {
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
        let imgPath: string
        if (
            node.kind !== ts.SyntaxKind.ImportDeclaration ||
            !IMG_EXTENSION_REGEX.test(imgPath = (node as ts.ImportDeclaration).moduleSpecifier.getText())
        ) {
            return ts.visitEachChild(node, visitor, ctx)
        }

        // Bc cssPath includes ' or "
        imgPath = imgPath.substring(1, imgPath.length - 1)

        if (imgPath.startsWith('.')) {
            const sourcePath = sf.fileName
            imgPath = resolve(dirname(sourcePath), imgPath)
        }

        const contentStr = readFileSync(imgPath).toString('base64')
        const ext = extname(imgPath).substr(1)
        const {
            threshold = 1e4,
            generateFilePath = path => path
        } = opts || {}
        let content: string
        // Embeds everything that's less than threshold
        // Bug in typedefs where byteLength only takes string
        if (Buffer.byteLength(contentStr) > threshold) {
            content = generateFilePath(generateImgPath(imgPath))
        } else {
            content = `data:image/${ext};base64,${contentStr}`
        }

        // This is the "foo" from "import * as foo from 'foo.css'"
        const importVar = ((node as ts.ImportDeclaration).importClause.namedBindings as ts.NamespaceImport).name.getText()

        const cssVarStatement = ts.createNode(ts.SyntaxKind.VariableStatement) as ts.VariableStatement

        cssVarStatement.declarationList = ts.createNode(ts.SyntaxKind.VariableDeclarationList) as ts.VariableDeclarationList
        const varDecl = ts.createNode(ts.SyntaxKind.VariableDeclaration) as ts.VariableDeclaration
        varDecl.name = ts.createNode(ts.SyntaxKind.Identifier) as ts.Identifier
        varDecl.name.text = importVar
        varDecl.initializer = ts.createNode(ts.SyntaxKind.StringLiteral) as ts.StringLiteral
        (varDecl.initializer as ts.StringLiteral).text = content
        cssVarStatement.declarationList.declarations = [varDecl] as ts.NodeArray<ts.VariableDeclaration>
        return cssVarStatement
    }

    return visitor
}

export default function (opts?: Opts) {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf, opts))
    }
}