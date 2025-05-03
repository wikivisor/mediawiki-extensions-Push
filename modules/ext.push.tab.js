/**
 * JavaScript for the Push tab in the Push extension.
 *
 * @see https://www.mediawiki.org/wiki/Extension:Push
 * @author Jeroen De Dauw <jeroendedauw at gmail dot com>
 */

$( () => {

	let pages,
		targetData = [],
		$pushButton = $( '.push-button' ),
		$pushAllButton = $( '#push-all-button' ),
		$txtTemplateList = $( '#txtTemplateList' ),
		$txtFileList = $( '#txtFileList' ),
		$checkIncFiles = $( '#checkIncFiles' );

	$pushButton.each( function () {
		getRemoteArticleInfo( $( this ).attr( 'targetid' ), $( this ).attr( 'pushtarget' ) );
	} );

	$pushButton.on( 'click', function () {
		this.disabled = true;

		const $errorDiv = $( '#targeterrors' + $( this ).attr( 'targetid' ) );
		$errorDiv.fadeOut( 'fast' );

		if ( $( '#checkIncTemplates' ).prop( 'checked' ) ) {
			pages = mw.config.get( 'wgPushTemplates' );
			pages.unshift( $( '#pageName' ).attr( 'value' ) );
		} else {
			pages = [ $( '#pageName' ).attr( 'value' ) ];
		}

		setButtonToImgPush(
			this,
			pages,
			$( this ).attr( 'pushtarget' ),
			$( this ).attr( 'targetname' )
		);
	} );

	$pushAllButton.on( 'click', function () {
		this.disabled = true;
		this.textContent = mw.msg( 'push-button-pushing' );
		$pushButton.tigger( 'click' );
	} );

	$( '#divIncTemplates' ).on( 'hover',
		() => {
			const isHidden = $txtTemplateList.css( 'opacity' ) === 0;

			if ( isHidden ) {
				$txtTemplateList.css( 'display', 'inline' );
			}

			$txtTemplateList.fadeTo(
				isHidden ? 'slow' : 'fast',
				1
			);
		},
		() => {
			$txtTemplateList.fadeTo( 'fast', 0.5 );
		}
	).on( 'click', () => {
		setIncludeFilesText();
		displayTargetsConflictStatus();
	} );

	$( '#divIncFiles' ).on( 'click', () => {
		displayTargetsConflictStatus();
	} ).on( 'hover',
		() => {
			const isHidden = $txtFileList.css( 'opacity' ) === 0;

			if ( isHidden ) {
				$txtFileList.css( 'display', 'inline' );
				setIncludeFilesText();
			}

			$txtFileList.fadeTo(
				isHidden ? 'slow' : 'fast',
				1
			);
		},
		() => {
			$txtFileList.fadeTo( 'fast', 0.5 );
		}
	);

	function setIncludeFilesText() {
		if ( $checkIncFiles.length !== 0 ) {
			let files = mw.config.get( 'wgPushPageFiles' );

			if ( $( '#checkIncTemplates' ).prop( 'checked' ) ) {
				files = files.concat( mw.config.get( 'wgPushTemplateFiles' ) );
			}

			if ( files.length > 0 ) {
				$txtFileList.text( '(' + mw.msg( 'push-tab-embedded-files' ) + ' ' );

				for ( const i in files ) {
					if ( Object.prototype.hasOwnProperty.call( files, i ) ) {
						if ( i > 0 ) {
							$txtFileList.append( ', ' );
						}
						$txtFileList.append(
							$( '<a>' )
								.attr( 'href', mw.config.get( 'wgPushIndexPath' ) + '?title=' + files[ i ] )
								.text( files[ i ] )
						);
					}
				}

				$txtFileList.append( ')' );
			} else {
				$txtFileList.text( mw.msg( 'push-tab-no-embedded-files' ) );
			}
		}
	}

	function getRemoteArticleInfo( targetId, targetUrl ) {
		const pageName = $( '#pageName' ).attr( 'value' );

		$.getJSON(
			targetUrl + '/api.php?callback=?',
			{
				action: 'query',
				format: 'json',
				prop: 'revisions',
				rvprop: 'timestamp|user|comment',
				titles: [ pageName ]
					.concat( mw.config.get( 'wgPushTemplates' ) )
					.concat( mw.config.get( 'wgPushPageFiles' ) )
					.concat( mw.config.get( 'wgPushTemplateFiles' ) )
					.join( '|' )
			},
			( data ) => {
				if ( data.query ) {
					const $infoDiv = $( '#targetinfo' + targetId );

					const existingPages = [];
					let remotePage = false;
					let message;

					for ( const remotePageId in data.query.pages ) {
						if ( Object.prototype.hasOwnProperty.call( data.query.pages, remotePageId ) ) {
							if ( remotePageId > 0 ) {
								if ( data.query.pages[ remotePageId ].title === pageName ) {
									remotePage = data.query.pages[ remotePageId ];
								} else {
									existingPages.push( data.query.pages[ remotePageId ] );
								}
							}
						}
					}

					targetData[ targetId ] = { existingPages: existingPages };

					if ( remotePage ) {
						$( '#targetlink' + targetId ).attr( 'class', '' );

						const revision = remotePage.revisions[ 0 ];
						const dateTime = revision.timestamp.split( 'T' );

						message = mw.msg(
							'push-tab-last-edit',
							revision.user,
							dateTime[ 0 ],
							dateTime[ 1 ].replace( 'Z', '' )
						);
					} else {
						$( '#targetlink' + targetId ).attr( 'class', 'new' );
						message = mw.msg( 'push-tab-not-created' );
					}

					$infoDiv.text( message );
					$infoDiv.fadeIn( 'slow' );

					displayTargetConflictStatus( targetId );
				}
			}
		);
	}

	function displayTargetsConflictStatus() {
		$( '.push-button' ).each( function () {
			displayTargetConflictStatus( $( this ).attr( 'targetid' ) );
		} );
	}

	function displayTargetConflictStatus( targetId ) {
		let remotePageId;

		if ( !targetData[ targetId ] ) {
			// It's possible the request to retrieve this data failed, so don't do anything when this is the case.
			return;
		}

		if ( $( '#checkIncTemplates' ).prop( 'checked' ) ) {
			const overrideTemplates = [];

			for ( remotePageId in targetData[ targetId ].existingPages ) {
				if ( Object.prototype.hasOwnProperty.call( targetData[ targetId ].existingPages, remotePageId ) ) {
					if ( targetData[ targetId ].existingPages[ remotePageId ].ns === 10 ) {
						// Add the template, but get rid of the namespace prefix first.
						overrideTemplates.push( targetData[ targetId ].existingPages[ remotePageId ].title.split( ':', 2 )[ 1 ] );
					}
				}
			}

			if ( overrideTemplates.length > 0 ) {
				$( '#targettemplateconflicts' + targetId )
					.text( mw.msg( 'push-tab-template-override',
						overrideTemplates.join( ', ' ),
						overrideTemplates.length
					) )
					.fadeIn( 'slow' );
			} else {
				$( '#targettemplateconflicts' + targetId ).fadeOut( 'slow' );
			}
		} else {
			$( '#targettemplateconflicts' + targetId ).fadeOut( 'fast' );
		}

		if ( $checkIncFiles.length !== 0 && $checkIncFiles.prop( 'checked' ) ) {
			const overideFiles = [];

			for ( remotePageId in targetData[ targetId ].existingPages ) {
				if ( Object.prototype.hasOwnProperty.call( targetData[ targetId ].existingPages, remotePageId ) ) {
					if ( targetData[ targetId ].existingPages[ remotePageId ].ns === 6 ) {
						// Add the file, but get rid of the namespace prefix first.
						overideFiles.push( targetData[ targetId ].existingPages[ remotePageId ].title.split( ':', 2 )[ 1 ] );
					}
				}
			}

			if ( overideFiles.length > 0 ) {
				$( '#targetfileconflicts' + targetId )
					.text( mw.msg( 'push-tab-files-override',
						overideFiles.join( ', ' ),
						overideFiles.length
					) )
					.fadeIn( 'slow' );
			} else {
				$( '#targetfileconflicts' + targetId ).fadeOut( 'slow' );
			}
		} else {
			$( '#targetfileconflicts' + targetId ).fadeOut( 'fast' );
		}
	}

	function initiatePush( sender, pages, targetUrl, targetName ) {
		sender.textContent = mw.msg( 'push-button-pushing' );

		new mw.Api().postWithEditToken( {
			action: 'push',
			page: pages,
			targets: targetUrl
		} ).done( ( data ) => {
			if ( data.error ) {
				handleError( sender, data.error );
			} else if ( data[ 0 ] && data[ 0 ].error ) {
				handleError( sender, data[ 0 ].error );
			} else if ( data[ 0 ] && data[ 0 ].edit && data[ 0 ].edit.captcha ) {
				handleError( sender, { info: mw.msg( 'push-err-captacha', targetName ) } );
			} else {
				handlePushingCompletion( sender );
			}
		} ).fail( ( errorCode, data ) => {
			handleError( sender, data.error );
		} );
	}

	function handlePushingCompletion( sender ) {
		sender.textContent = mw.msg( 'push-button-completed' );

		setTimeout( () => {
			reEnableButton( sender );
		}, 1000 );
	}

	function setButtonToImgPush( button, pages, targetUrl, targetName ) {
		const images = mw.config.get( 'wgPushPageFiles' ).concat( mw.config.get( 'wgPushTemplateFiles' ) );

		if ( images.length > 0 && $checkIncFiles.length !== 0 && $checkIncFiles.prop( 'checked' ) ) {
			const currentFile = images.pop();
			button.textContent = mw.msg( 'push-button-pushing-files' );
			initiateImagePush( button, pages, targetUrl, targetName, images, currentFile );
		} else {
			initiatePush( button, pages, targetUrl, targetName );
		}
	}

	function initiateImagePush( sender, pages, targetUrl, targetName, images, fileName ) {
		new mw.Api().postWithEditToken( {
			action: 'pushimages',
			images: fileName,
			targets: targetUrl
		} ).done( ( data ) => {
			let fail = false;

			if ( data.error ) {
				data.error.info = mw.msg( 'push-tab-err-filepush', data.error.info );
				handleError( sender, data.error );
				fail = true;
			} else {
				for ( const i in data ) {
					if ( Object.prototype.hasOwnProperty.call( data, i ) ) {
						if ( data[ i ].error ) {

							// Do not treat "fileexists-no-change" as a fatal error, just
							// skip to next images silently
							if ( data[ i ].error.code === 'fileexists-no-change' ) {
								break;
							}

							data[ i ].error.info = mw.msg( 'push-tab-err-filepush', data[ i ].error.info );
							handleError( sender, data[ i ].error );
							fail = true;
							break;
						} else if ( !data[ i ].upload ) {
							data[ i ].error.info = mw.msg( 'push-tab-err-filepush-unknown' );
							handleError( sender, data[ i ].error );
							fail = true;
							break;
						}
					}
				}
			}

			if ( !fail ) {
				if ( images.length > 0 ) {
					const currentFile = images.pop();
					initiateImagePush( sender, pages, targetUrl, targetName, images, currentFile );
				} else {
					initiatePush( sender, pages, targetUrl, targetName );
				}
			}
		} ).fail( ( errorCode, data ) => {
			data.error.info = mw.msg( 'push-tab-err-filepush', data.error.info );
			handleError( sender, data.error );
		} );
	}

	function reEnableButton( button ) {
		button.textContent = mw.msg( 'push-button-text' );
		button.disabled = false;

		getRemoteArticleInfo( $( button ).attr( 'targetid' ), $( button ).attr( 'pushtarget' ) );

		// If there is a "push all" button, make sure to reset it
		// when all other buttons have been reset.
		if ( typeof $pushAllButton !== 'undefined' ) {
			let hasDisabled = false;

			$pushButton.each( function () {
				if ( this.disabled ) {
					hasDisabled = true;
				}
			} );

			if ( !hasDisabled ) {
				$pushAllButton.attr( 'disabled', false );
				$pushAllButton.text( mw.msg( 'push-button-all' ) );
			}
		}
	}

	function handleError( sender, error ) {
		const $errorDiv = $( '#targeterrors' + $( sender ).attr( 'targetid' ) );

		if ( error.code && error.code === 'uploaddisabled' ) {
			error.info = mw.msg( 'push-tab-err-uploaddisabled' );
		}

		$errorDiv.text( error.info );
		$errorDiv.fadeIn( 'slow' );

		sender.textContent = mw.msg( 'push-button-failed' );
		setTimeout( () => {
			reEnableButton( sender );
		}, 2500 );
	}

} );
