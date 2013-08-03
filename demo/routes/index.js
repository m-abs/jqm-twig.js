( function( exports ) {
  "use strict";

  exports.index = function(req, res){
    var
      fs = require( 'fs' ),
      data = {
        'title' : 'Twig.js + jQuery-mobile',
        'templates' : {}
      }
    ;

    [
      "templates/start.twig",
      "templates/includes/panel.twig",
      "templates/includes/panellink.twig"
    ].forEach( function( filepath ) {
      data.templates[ filepath.replace( /^templates\//, '' ) ] = fs.readFileSync( filepath );
    } );
  
    res.render( 'index', data );
  };
  
  exports.pageAjax = function( req, res ) {
    console.log( req.query, req.params );
    res.end( JSON.stringify( {} ) );
  };
  
  exports.logdata = function( req, res ) {
    console.log( req.body.data );
  };
} )( exports );
