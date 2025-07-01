import XCTest
import SwiftTreeSitter
import TreeSitterThyn

final class TreeSitterThynTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_thyn())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Thyn grammar")
    }
}
