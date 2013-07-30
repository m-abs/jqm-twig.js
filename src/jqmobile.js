/*global jQuery: true, Twig, twig */

/*!***************
 * Copyright (c) 2013 Morten Sjøgren <m_abs@mabs.dk>
 * Copyright (c) 2013 Peercraft ApS <hb@peercraft.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 ****************/

( function( $ ) {
	"use strict";

	var
		templates, // list of twig.js templates referenced by template id
		eventNameSpace = "jqm-twig",

		// Older Android browsers don't like fixed toolbars
		noFixedToolbar = /Android\s[23]/i.test( navigator.userAgent ),

		// Default page is the first landing page and if no hash onload, persondialoger
		default_page = "#" + ( window.location.hash.replace( /^#/, "" ) || "" ),

		// Wrapped elements
		$body,
		$window = $( window ),

		last_jqXHR, // Needed to cancel previous page request, or we can get an infinate loading loop.

		makeUrl = function( pageId, _params ) {
			return "#" + pageId + ( function( ) {
				var params = $.extend( true, {}, _params ),
					res;

				// No point in showing the system params to the user
				delete params.type;
				delete params.template;
				delete params.is_utf8;

				res = $.param( params );
				if ( res ) {
					return "?" + res;
				} else {
					return "";
				}
			} )( );
		},

		handleRequestError = function( data ) {
			( function( ) {
				var
					warningTitle = "Warning!",
					closeBtnIcon,
					closeBtnText,
					callback
				;

				if ( !data.msg ) {
					data.msg = "An error orcured";
				}

				$window.trigger( "show_warning", {
					"title"         : warningTitle,
					"warningText"   : data.msg,
					"closeBtnIcon"  : closeBtnIcon,
					"closeBtnText"  : closeBtnText,
					"closeCallBack" : callback
				} );
			} )( );
		},

		parseTemplateUrlFregment = function( href ) {
			var
				// getUrl is the url hash/fragment and must be formatted like this: "#<template>[?var1=1&var2=2]"
				getUrl   = href.replace( /^[^#]*#/, "" ),

				// template id
				template = getUrl.replace( /\?[^$]*|&[^$]*$/g, "" ) + ".twig",

				// pageId in the DOM
				pageId   = template.replace( /\.twig$/g, "" ),

				// Get params for the ajax request
				params   = ( function( ) {
					// Create the params object for the ajax request, from the get-params in the id.
					var res = {
							"type"     : "ajax",
							"template" : pageId,
							"is_utf8"  : true
						};

					$.each( ( href || "" ).replace( /^[^?]*\?/, "" ).split( "&" ), function( idx, data ) {
						var
							dArr  = data.split( "=" ),
							key   = dArr[0],
							value = dArr[1]
						;

						if ( key && value !== undefined ) {
							if ( key === "type" && value === "ajax" ||
								key === "template" ||
								key === "is_utf8" ||
								key === "ui-state" && value === "dialog"
							) {
								return;
							} else if ( key === "type" ) {
								throw key + " is a illegal key name";
							}
							res[ key ] = value;
						}
					} );

					return res;
				} )( )
			;

			return {
				"template" : template,
				"pageId"   : pageId,
				"params"   : params
			};
		},

		// handle navigation, by loading the data via ajax and rendering the templates via twig.js
		handleNavigation = function( href, no_reload ) {
			var
				urlData  = parseTemplateUrlFregment( href ),

				// template id
				template = urlData.template,

				// pageId in the DOM
				pageId   = urlData.pageId,

				// Old DOM element for the page
				old_el = $( "#" + pageId ),

				// Get params for the ajax request
				params   = urlData.params,

				// The pretty url
				new_url = makeUrl( pageId, params ),

				// Absolute page-url
				absUrl = ( window.location.protocol + "//" + window.location.host + window.location.pathname + ( href !== default_page ? new_url : "" ) ),

				templateObj = templates[ template ]
			;

			if ( !old_el[0] && href === default_page ) {
				// Reuse the initial page-element (wrapped body) for the default-page
				old_el = $.mobile.pageContainer.children( "[data-url='" + window.location.pathname + "']" );
				if ( old_el[0] ) {
					old_el.attr( "id", pageId );
				}
			}

			if ( last_jqXHR && last_jqXHR.abort && last_jqXHR.statusCode !== 200 ) {
				// An old XHR request is still loading.
				$window.trigger( "ajax_log", {
					"type" : "last_jqXHR.abort"
				} );

				last_jqXHR.abort( );
				last_jqXHR = undefined;
			}

			if ( templateObj ) {
				if ( no_reload ) {
					if ( old_el[0] &&
						old_el.data( "absUrl" ) === absUrl
					) {
						$.mobile.changePage( new_url, {
							"changeHash" : href !== default_page, // This lets the user go back to before he/she loaded the page
							"dataUrl"    : window.location.pathname + new_url // Write a pretty url for the user to see
						} );
						return;
					}
				}

				// If the template exists, request the data for the template via AJAX
				last_jqXHR = $.ajax( window.location.pathname, {
					"data": params,
					"success" : function( twigParams ) {
						last_jqXHR = undefined;

						try {
							if ( twigParams.redirect_to_normal_interface && twigParams.back_to_web_link ) {
								window.location.href = "/mobile_redirect.php?url=" + window.encodeURIComponent( twigParams.back_to_web_link ) + "&allow=internal";
								return;
							}

							if ( twigParams.error ) {
								$.hn_handleRequestError( twigParams );
								return false;
							}

							// Tell the template if fixed toolbars are allowed or not
							twigParams.noFixedToolbar = noFixedToolbar;

							var
								panelId = "nav-panel-" + pageId,

								// Newly generated HTML from twig.js
								new_html = $(
									$.parseHTML(
										templateObj.render(
											$.extend( true, {
												"panelId" : panelId
											}, twigParams )
										)
									)
								),
								changeHash = true
							;

							if ( old_el[0] ) {
								// The page-node already exists.
								// This is needed or JQM throws some exceptions because the page wasn't initialized but it thought it was.
								old_el
									.empty( )
									.append( new_html.children( ) )
									.off( ".panel" )
									.trigger( "pageremove" )
									.attr( "data-url", new_url )
									.data( "url", new_url )
									.trigger( "pagecreate" )
								;
							} else {
								// New page, insert it into body
								new_html
									.attr( {
										"id" : pageId
									} )
									.appendTo( $body )
									.data( "url", new_url )
									.on( "pagecreate pagebeforeshow pagebeforehide pagebeforechange", function( e ) {
										var $this = $( this );
										if ( e.type === "pagecreate" ) {
											// Since we reuse the page element, panels must be destroyed on the old page.
											// If we don't do this, the new panel won't open.
											$this.find( "ui-panel" )
												.panel( "destroy" );
										}
									} )
								;
							}

							changeHash = href !== default_page ||
								!!old_el[0] && !!old_el.data( "absUrl" ) && old_el.data( "absUrl" ) !== absUrl; // This lets the user go back to before he/she loaded the page

							// Load the new page
							$.mobile.changePage( new_url, {
								"transition"              : "none",      // Transitions looks strange on older mobiles
								"allowSamePageTransition" : !!old_el[0], // previously loaded pages don't show the transition effect without this
								"changeHash"              : changeHash, // This lets the user go back to before he/she loaded the page
								"dataUrl"                 : window.location.pathname + new_url // Write a pretty url for the user to see
							} );
						} catch( exp ) {
							$window.trigger( "ajax_log", {
								"type" : "error",
								"data" : {
									"message" : exp,
									"stack"   : exp.stack
								}
							} );

							throw exp;
						}
					},
					"error" : function( jqXHR ) {
						try{
							var data = $.parseJSON( jqXHR.responseText );

							if ( data && data.error ) {
								$.hn_handleRequestError( data );
							}
						} catch ( exp ) {
							$.hn_handleRequestError( {
								"response" : jqXHR.responseText,
								"exception" : exp
							});
						}
					},
					"dataType" : "json"
				} );

				$.mobile.loading( "show" );
			} else {
				throw  "Ukendt template " + template + ", href var " + href;
			}
		}
	;

	$.parseTemplateUrlFregment = parseTemplateUrlFregment;
	$.jqmobile_makeUrl = makeUrl;
	$.hn_handleRequestError = handleRequestError;

	// Setup jquery mobile - please note that mobileinit is triggered before document ready
	$( document ).on( "mobileinit", function( ) {
		// We need to modify previously loaded pages, keep them in DOM so we can select them
		$.mobile.page.prototype.options.domCache = true;

		// Page settings
		$.mobile.page.prototype.options.theme  = "b";
		$.mobile.page.prototype.options.headerTheme  = "a";  // Page header only
		$.mobile.page.prototype.options.footerTheme  = "a";

		// Panel settings
		$.mobile.panel.prototype.options.theme  = "a";

		// Dialog settings
		$.mobile.dialog.prototype.options.overlayTheme = "b";

		// Listview settings
		$.mobile.listview.prototype.options.countTheme = "d";
	} );

	jQuery( function( $ ) {
		var just_navigated = "",
			warningTemplate,
			timeout;

		$body = $( document.body );

		templates = // list of twig.js templates referenced by template id
			( function( elements ) {
				var res = {
				};

				$.each( elements, function( idx, _el ) {
					var
						el = $( _el ),
						id   = el.data( "template-id" ),
						text = el.text( ) || el.html( ), // Prefer text but since old <=IE8 returns empty string use html
						template
					;

					if ( id ) {
						template = twig( {
							"id"                  : id,
							"allowInlineIncludes" : true,
							"data"                : $.trim( text )
						} );

						if ( id === "warning.dialog.twig" ) {
							warningTemplate = template;
						} else {
							res[ id ] = template;
						}
					}

					el.remove( );
				} );

				return res;
			} )( $body.find( "script[type=\"x-tmpl-twigjs\"]" ) );

		// Handle handle warnings
		if ( warningTemplate ) {
			$window.on( "show_warning", function( e, data ) {
				var
					tmpWarning = $(
							$.parseHTML( warningTemplate.render( data ) )
						)
						.on( "pagehide", function( ) {
							tmpWarning.dialog( "destroy" );
							tmpWarning.remove( );
							tmpWarning = undefined;

						} )
						.on( "click", ".close-button", function( e ) {
							if ( $.isFunction( data.closeCallBack ) ) {
								if ( data.closeCallBack.apply( data ) === false ) {
									e.preventDefault( );
									e.stopPropagation( );
									return false;
								}
							}
						} )
						.appendTo( $body ),
					newId = tmpWarning.attr( "id" ) + "-" + Math.max( Math.min( 10000, Math.floor( Math.random( ) * 10000 ) ), 100 )
				;

				tmpWarning
					.attr( "id", newId );

				$.mobile.changePage( "#" + newId, {
					"changeHash" : true,
					"role"       : "dialog"
				} );
			} );
		}

		$body.on( "click." + eventNameSpace, "a", function( e ) {
			var $this = $( this ),
				data = {},
				href = $this.attr( "href" ) || "";

			if (
				$this.data( "ajax" ) === false || // We've intentionally disabled ajax
				$this.data( "rel" ) === "close" || // used in the panel to close it
				$this.data( "rel" ) === "back" // General back link
			) {
				// Don't handle this is no ajax or a back click
				return;
			} else if ( href[0] === "#" ) {
				e.preventDefault( );

				try {

					// Make the link non-blue after mouseup
					setTimeout( function( ) {
						$this
							.closest( ".ui-btn" )
							.removeClass( "ui-btn-active" )
						;
					}, 100 );

					if ( href === "#" ) {
						// Just a # link assume default page
						href = default_page;
					}

					if ( $this.closest( ".ui-panel" )[0] ) {
						data.force_reload = true;
					}

					// Navigate to the href
					$.mobile.navigate( href, data );
				} catch( exp ) {
					$window.trigger( "ajax_log", {
						"type" : "error",
						"data" : exp
					} );
					throw exp;
				}

				return;
			}
		} );

		// Capture navigation changes
		$window.on( "navigate." + eventNameSpace, function( e, _data ) {
			try {
				if ( $.mobile.activePage ) {
					// Close panel
					$.mobile.activePage
						.find( ".ui-panel.ui-panel-open" )
						.panel( "close" );
				}

				if ( timeout ) {
					window.clearTimeout( timeout );
				}

				var
					logData = {
						"type" : e.type
					},
					data = $.extend( true, {
						"state" : {
							"hash" : window.location.hash || default_page,
							"direction" : ""
						}
					}, _data ),
					hash = "" + data.state.hash,
					no_reload = false
				;

				logData._data = _data;
				logData.data  = data;

				if ( hash === ( window.location.protocol + "//" + window.location.host + window.location.pathname ) ) {
					// If we get a hash in this pattern, it's actual an empty hash but JQM gives us til page URL, to to the default page
					hash = default_page;
				}

				logData.hash = hash;

				if ( !data.force_reload && hash === just_navigated ) {
					// We just navigated to this page just, so stop, unless forces
					just_navigated = "";

					logData.stop_for_just_navigated = true;

					$window.trigger( "ajax_log", logData );
					return;
				}

				no_reload = data.state.direction === "back";
				logData.no_reload = no_reload;

				$window.trigger( "ajax_log", logData );

				handleNavigation( hash, data.state.direction === "back" );
				just_navigated = hash;

				e.preventDefault( );
			} catch( exp ) {
				$window.trigger( "ajax_log", {
					"type" : "error",
					"data" : exp
				} );

				throw exp;
			}
		} );

		$window.on( "ajax_log." + eventNameSpace, function( e, _data ) {
			if ( !_data ) {
				return;
			}

			$.post( window.location.pathname, {
				"type"    : "ajax",
				"action"  : "logdata",
				"is_utf8" : 1,
				"data"    : _data
			} );
		} );

		// Load default page after 100ms (delay is to wait for jquerymobile to trigger the event it self).
		timeout = window.setTimeout( function( ) {
			try {
				$window.trigger( "ajax_log", {
					"type" : "first_load",
					"data" : default_page
				} );

				$.mobile.navigate( default_page );
			} catch( exp ) {
				$window.trigger( "ajax_log", {
					"type" : "error",
					"data" : exp
				} );

				throw exp;
			}
		}, 100 );
	} );
} )( jQuery );
