/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { store as editSiteStore } from '../../store';

export default function useTemplateEditNotifications() {
	const { hasPageContentLock, isNonContentBlockSelected } = useSelect(
		( select ) => {
			const {
				getSettings,
				getSelectedBlockClientId,
				getBlockParents,
				getBlockName,
			} = select( blockEditorStore );
			const { contentBlockTypes } = getSettings();
			const selectedClientId = getSelectedBlockClientId();
			return {
				hasPageContentLock:
					select( editSiteStore ).hasPageContentLock(),
				isNonContentBlockSelected:
					selectedClientId &&
					! contentBlockTypes.includes(
						getBlockName( selectedClientId )
					) &&
					getBlockParents( selectedClientId ).every(
						( parent ) =>
							! contentBlockTypes.includes(
								getBlockName( parent )
							)
					),
			};
		},
		[]
	);

	const { togglePageContentLock } = useDispatch( editSiteStore );

	const { createInfoNotice } = useDispatch( noticesStore );

	const hasShownBlockNotification = useRef( false );

	useEffect( () => {
		if (
			hasPageContentLock &&
			isNonContentBlockSelected &&
			! hasShownBlockNotification.current
		) {
			hasShownBlockNotification.current = true;
			createInfoNotice( __( 'Edit your template to edit this block' ), {
				isDismissible: true,
				type: 'snackbar',
				actions: [
					{
						label: __( 'Edit template' ),
						onClick: () => togglePageContentLock( false ),
					},
				],
			} );
		}
	}, [
		hasPageContentLock,
		isNonContentBlockSelected,
		hasShownBlockNotification,
		createInfoNotice,
		togglePageContentLock,
	] );

	const prevHasPageContentLock = useRef( null );
	const hasShownTemplateNotification = useRef( false );

	useEffect( () => {
		if (
			! hasPageContentLock &&
			prevHasPageContentLock.current &&
			! hasShownTemplateNotification.current
		) {
			hasShownTemplateNotification.current = true;
			createInfoNotice( __( 'You are editing a template' ), {
				isDismissible: true,
				type: 'snackbar',
				actions: [
					{
						label: __( 'Back to page' ),
						onClick: () => togglePageContentLock( true ),
					},
				],
			} );
		}
		prevHasPageContentLock.current = hasPageContentLock;
	}, [
		hasPageContentLock,
		prevHasPageContentLock,
		hasShownTemplateNotification,
		createInfoNotice,
		togglePageContentLock,
	] );
}
