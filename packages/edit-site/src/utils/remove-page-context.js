export default function removePageContext( context ) {
	return {
		...context,
		postType: null,
		postId: null,
	};
}
