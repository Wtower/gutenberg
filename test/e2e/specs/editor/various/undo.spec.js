/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.use( {
	undoUtils: async ( { page }, use ) => {
		await use( new UndoUtils( { page } ) );
	},
} );

class UndoUtils {
	constructor( { page } ) {
		this.page = page;

		this.getSelection = this.getSelection.bind( this );
	}

	async getSelection() {
		return await this.page.evaluate( () => {
			const selectedBlock = document.activeElement.closest( '.wp-block' );
			const blocks = Array.from(
				document.querySelectorAll( '.wp-block' )
			);
			const blockIndex = blocks.indexOf( selectedBlock );

			if ( blockIndex === -1 ) {
				return {};
			}

			let editables;

			if ( selectedBlock.getAttribute( 'contenteditable' ) ) {
				editables = [ selectedBlock ];
			} else {
				editables = Array.from(
					selectedBlock.querySelectorAll( '[contenteditable]' )
				);
			}

			const editableIndex = editables.indexOf( document.activeElement );
			const selection = window.getSelection();

			if ( editableIndex === -1 || ! selection.rangeCount ) {
				return { blockIndex };
			}

			const range = selection.getRangeAt( 0 );
			const cloneStart = range.cloneRange();
			const cloneEnd = range.cloneRange();

			cloneStart.setStart( document.activeElement, 0 );
			cloneEnd.setStart( document.activeElement, 0 );

			/**
			 * Zero width non-breaking space, used as padding in the editable DOM
			 * tree when it is empty otherwise.
			 */
			const ZWNBSP = '\ufeff';

			return {
				blockIndex,
				editableIndex,
				startOffset: cloneStart.toString().replace( ZWNBSP, '' ).length,
				endOffset: cloneEnd.toString().replace( ZWNBSP, '' ).length,
			};
		} );
	}
}

test.describe( 'undo', () => {
	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test( 'should undo typing after a pause', async ( {
		editor,
		page,
		pageUtils,
		undoUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( 'before pause' );
		await new Promise( ( resolve ) => setTimeout( resolve, 1000 ) );
		await page.keyboard.type( ' after pause' );

		const after = await editor.getEditedPostContent();

		expect( after ).toBe(
			`<!-- wp:paragraph -->
<p>before pause after pause</p>
<!-- /wp:paragraph -->`
		);

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		const before = await editor.getEditedPostContent();
		expect( before ).toBe(
			`<!-- wp:paragraph -->
<p>before pause</p>
<!-- /wp:paragraph -->`
		);

		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before pause'.length,
			endOffset: 'before pause'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( '' );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( before );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before pause'.length,
			endOffset: 'before pause'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( after );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before pause after pause'.length,
			endOffset: 'before pause after pause'.length,
		} );
	} );

	test( 'should undo typing after non input change', async ( {
		editor,
		page,
		pageUtils,
		undoUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );

		await page.keyboard.type( 'before keyboard ' );
		await pageUtils.pressKeyWithModifier( 'primary', 'b' );
		await page.keyboard.type( 'after keyboard' );

		const after = await editor.getEditedPostContent();

		expect( after ).toBe(
			`<!-- wp:paragraph -->
<p>before keyboard <strong>after keyboard</strong></p>
<!-- /wp:paragraph -->`
		);

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		const before = await editor.getEditedPostContent();

		expect( before ).toBe(
			`<!-- wp:paragraph -->
<p>before keyboard </p>
<!-- /wp:paragraph -->`
		);
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before keyboard '.length,
			endOffset: 'before keyboard '.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( '' );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( before );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before keyboard '.length,
			endOffset: 'before keyboard '.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( after );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'before keyboard after keyboard'.length,
			endOffset: 'before keyboard after keyboard'.length,
		} );
	} );

	test( 'should undo bold', async ( { page, pageUtils } ) => {
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( 'test' );
		await page.click( 'role=button[name="Save draft"i]' );
		await expect(
			page.locator(
				'role=button[name="Dismiss this notice"i] >> text=Draft saved'
			)
		).toBeVisible();
		await page.reload();
		await page.click( '[data-type="core/paragraph"]' );
		await pageUtils.pressKeyWithModifier( 'primary', 'a' );
		await pageUtils.pressKeyWithModifier( 'primary', 'b' );
		await pageUtils.pressKeyWithModifier( 'primary', 'z' );
		const visibleResult = await page.evaluate(
			() => document.activeElement.innerHTML
		);
		expect( visibleResult ).toBe( 'test' );
	} );

	test( 'Should undo/redo to expected level intervals', async ( {
		editor,
		page,
		pageUtils,
		undoUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );

		const firstBlock = await editor.getEditedPostContent();

		await page.keyboard.type( 'This' );

		const firstText = await editor.getEditedPostContent();

		await page.keyboard.press( 'Enter' );

		const secondBlock = await editor.getEditedPostContent();

		await page.keyboard.type( 'is' );

		const secondText = await editor.getEditedPostContent();

		await page.keyboard.press( 'Enter' );

		const thirdBlock = await editor.getEditedPostContent();

		await page.keyboard.type( 'test' );

		const thirdText = await editor.getEditedPostContent();

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 3rd paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( thirdBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 3,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 3rd block.

		await expect.poll( editor.getEditedPostContent ).toBe( secondText );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 2,
			editableIndex: 0,
			startOffset: 'is'.length,
			endOffset: 'is'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 2nd paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( secondBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 2,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 2nd block.

		await expect.poll( editor.getEditedPostContent ).toBe( firstText );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'This'.length,
			endOffset: 'This'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 1st paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( firstBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' ); // Undo 1st block.

		await expect.poll( editor.getEditedPostContent ).toBe( '' );
		await expect.poll( undoUtils.getSelection ).toEqual( {} );
		// After undoing every action, there should be no more undo history.
		await expect(
			page.locator( 'role=button[name="Undo"]' )
		).toBeDisabled();

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 1st block.

		await expect.poll( editor.getEditedPostContent ).toBe( firstBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );
		// After redoing one change, the undo button should be enabled again.
		await expect(
			page.locator( 'role=button[name="Undo"]' )
		).toBeEnabled();

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 1st paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( firstText );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 1,
			editableIndex: 0,
			startOffset: 'This'.length,
			endOffset: 'This'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 2nd block.

		await expect.poll( editor.getEditedPostContent ).toBe( secondBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 2,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 2nd paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( secondText );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 2,
			editableIndex: 0,
			startOffset: 'is'.length,
			endOffset: 'is'.length,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 3rd block.

		await expect.poll( editor.getEditedPostContent ).toBe( thirdBlock );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 3,
			editableIndex: 0,
			startOffset: 0,
			endOffset: 0,
		} );

		await pageUtils.pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 3rd paragraph text.

		await expect.poll( editor.getEditedPostContent ).toBe( thirdText );
		await expect.poll( undoUtils.getSelection ).toEqual( {
			blockIndex: 3,
			editableIndex: 0,
			startOffset: 'test'.length,
			endOffset: 'test'.length,
		} );
	} );

	test( 'should undo for explicit persistence editing post', async ( {
		page,
		pageUtils,
	} ) => {
		// Regression test: An issue had occurred where the creation of an
		// explicit undo level would interfere with blocks values being synced
		// correctly to the block editor.
		//
		// See: https://github.com/WordPress/gutenberg/issues/14950

		// Issue is demonstrated from an edited post: create, save, and reload.
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( 'original' );
		await page.click( 'role=button[name="Save draft"i]' );
		await expect(
			page.locator(
				'role=button[name="Dismiss this notice"i] >> text=Draft saved'
			)
		).toBeVisible();
		await page.reload();
		await page.waitForSelector( '.edit-post-layout' );

		// Issue is demonstrated by forcing state merges (multiple inputs) on
		// an existing text after a fresh reload.
		await page.click( '[data-type="core/paragraph"] >> nth=0' );
		await page.keyboard.type( 'modified' );

		// The issue is demonstrated after the one second delay to trigger the
		// creation of an explicit undo persistence level.
		await new Promise( ( resolve ) => setTimeout( resolve, 1000 ) );

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		// Assert against the _visible_ content. Since editor state with the
		// regression present was accurate, it would produce the correct
		// content. The issue had manifested in the form of what was shown to
		// the user since the blocks state failed to sync to block editor.
		const visibleContent = await page.evaluate(
			() => document.activeElement.textContent
		);
		expect( visibleContent ).toBe( 'original' );
	} );

	test( 'should not create undo levels when saving', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( '1' );
		await page.click( 'role=button[name="Save draft"i]' );
		await expect(
			page.locator(
				'role=button[name="Dismiss this notice"i] >> text=Draft saved'
			)
		).toBeVisible();
		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( '' );
	} );

	test( 'should not create undo levels when publishing', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( '1' );
		await editor.publishPost();
		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		await expect.poll( editor.getEditedPostContent ).toBe( '' );
	} );

	test( 'should immediately create an undo level on typing', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await page.click( 'role=button[name="Add default block"i]' );

		await page.keyboard.type( '1' );
		await page.click( 'role=button[name="Save draft"i]' );
		await expect(
			page.locator(
				'role=button[name="Dismiss this notice"i] >> text=Draft saved'
			)
		).toBeVisible();
		await page.reload();
		await page.waitForSelector( '.edit-post-layout' );

		// Expect undo button to be disabled.
		await expect(
			page.locator( 'role=button[name="Undo"]' )
		).toBeDisabled();
		await page.click( '[data-type="core/paragraph"]' );

		await page.keyboard.type( '2' );

		// Expect undo button to be enabled.
		await expect(
			page.locator( 'role=button[name="Undo"]' )
		).toBeEnabled();

		await pageUtils.pressKeyWithModifier( 'primary', 'z' );

		// Expect "1".
		await expect.poll( editor.getEditedPostContent ).toBe(
			`<!-- wp:paragraph -->
<p>1</p>
<!-- /wp:paragraph -->`
		);
	} );

	test( 'should be able to undo and redo when transient changes have been made and we update/publish', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		// Typing consecutive characters in a `Paragraph` block updates the same
		// block attribute as in the previous action and results in transient edits
		// and skipping `undo` history steps.
		const text = 'tonis';
		await page.click( 'role=button[name="Add default block"i]' );
		await page.keyboard.type( text );
		await editor.publishPost();
		await pageUtils.pressKeyWithModifier( 'primary', 'z' );
		await expect.poll( editor.getEditedPostContent ).toBe( '' );
		await page.waitForSelector(
			'.editor-history__redo[aria-disabled="false"]'
		);
		await page.click( '.editor-history__redo[aria-disabled="false"]' );
		await expect.poll( editor.getEditedPostContent ).toBe(
			`<!-- wp:paragraph -->
<p>tonis</p>
<!-- /wp:paragraph -->`
		);
	} );
} );
