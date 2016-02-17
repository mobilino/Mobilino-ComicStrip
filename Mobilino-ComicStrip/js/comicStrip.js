/* jshint eqnull:true */
window.comicStrip = (function($) {
	'use strict';
	var touchStartX = 0;
	var touchStartY = 0;
    var bodyTouchStartX = 0;
    var bodyTouchStartY = 0;
	var currentDeltaX = 0;
	var currentDeltaY = 0;
	var screenWidth = 0;
	var screenHeight = 0;
	var CURRENT_DIV = "#current";
	var OLDER_DIV = "#older";
	var YOUNGER_DIV = "#younger";
	var imgDataArray = [];
	var imgDataIndex = 0;
	var loadMoreUrl = "";
	var providerArray = [{name: 'Dilbert', url: 'http://dilbert.com', stripSelector: '.img-comic', descAttrParent: 'href', moreSelector: '.js_load_comics'},
	                     {name: 'xkcd', url: 'http://xkcd.com', stripSelector: '#comic img', descAttr: 'alt', moreSelector: "a[rel='prev']"}];
	var providerIndex = null;
	var STATUS_LOADING = "loading";
	var STATUS_DISPLAY_STRIP = "strip";
	var STATUS_TRANSITION = "transitionToNextStrip";
	var STATUS_MENU = "menu";
	var currentAppStatus = STATUS_LOADING;

	// --------------- scroll in current strip -----------------------
	function onTouchStart(x, y) {
		touchStartX = x - currentDeltaX;
		touchStartY = y - currentDeltaY;
	}

	function applyBoundaries(tmpValue, min) {
		if (tmpValue >= 0) {
			tmpValue = 0;
		}
		if (tmpValue <= min) {
			tmpValue = min;
		}
		return tmpValue;
	}

	function onTouchMove(x, y) {
		if (imgDataArray[imgDataIndex].width > screenWidth - 2) {
			var tmpDeltaX = applyBoundaries(x - touchStartX, -(imgDataArray[imgDataIndex].width - screenWidth + 2));
			if (tmpDeltaX !== currentDeltaX) {
				currentDeltaX = tmpDeltaX;
				$("#current img ").css("left", currentDeltaX);
			}
		}
		if (imgDataArray[imgDataIndex].height > (screenHeight / 100 * 69)) {
			var tmpDeltaY = applyBoundaries(y - touchStartY, -(imgDataArray[imgDataIndex].height - (screenHeight / 100 * 69) + 2));
			if (tmpDeltaY !== currentDeltaY) {
			    bodyTouchStartY = 0; //disable swipe detection on body.
				currentDeltaY = tmpDeltaY;
				$("#current img").css("top", currentDeltaY);
			  } else if (bodyTouchStartX !== 0 && bodyTouchStartY === 0) {
			    bodyTouchStartY = y; //enable swipe detection on body again.
			  }
		}
	}

	function onTouchEnd(x, y) {
		onTouchMove(x, y);
		touchStartX = 0;
		touchStartY = 0;
	}

	function resetImgState() {
		currentDeltaX = 0;
		currentDeltaY = 0;
	}

	// --------------- swipe to next strip -----------------------
	function onBodyTouchStart(x, y) {
		bodyTouchStartX = x;
		bodyTouchStartY = y;
    }

    function onBodyTouchEnd(x, y) {
		if (bodyTouchStartY !== 0 && currentAppStatus !== STATUS_TRANSITION) {
		  var distanceX = bodyTouchStartX - x;
		  var distanceY = bodyTouchStartY - y;
		  if (Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > 60) {
		    if (distanceY > 0) {
		      scrollUp();
		    } else {
		      scrollDown();
		    }
		  }
		}
	    }
	// --------------- load and display a strip -----------------------
	function refreshCurrentDesc() {
		if (imgDataIndex < imgDataArray.length) {
			$("#currentDesc").html(imgDataArray[imgDataIndex].desc);
		}
	}

	function loadImg(target, imgIndex) {
		if (target === CURRENT_DIV) {
			refreshCurrentDesc();
			resetImgState();
		}
		var img = $('<img id="dynamic">');
		img.attr('src', imgDataArray[imgIndex].src);
		img.css('opacity', "0");
		img.appendTo(target);
		img.load(function() {
			$(target).css('height', img.height());
			if (target == YOUNGER_DIV) {
				// youngest should always 'end' at the same point. Conseqeuntly we
				// need to adjust the top property if the height of the img changes.
				$(YOUNGER_DIV).css('top', -$(YOUNGER_DIV).height() + ($(window).height() / 10) + "px");
			}
			imgDataArray[imgIndex].width = img.width();
			imgDataArray[imgIndex].height = img.height();
			img.animate({
				opacity : (target === CURRENT_DIV ? '0.5' : '0.2')
			}, 290);
			if (target === CURRENT_DIV && currentAppStatus !== STATUS_MENU) {
				currentAppStatus = STATUS_DISPLAY_STRIP;
			}
		});
	}

	// --------------- extract strip SRC from homepage -----------------------
	function extractImgSrc(data) {
		// extract img's
		var myData = $(data);
		myData.find(providerArray[providerIndex].stripSelector).each(function(index, element) {
			var desc;
			if (providerArray[providerIndex].descAttrParent) {
				desc = $(element).parent().attr(providerArray[providerIndex].descAttrParent);
			} else {
				desc = $(element).attr(providerArray[providerIndex].descAttr);
			}
			if (desc && desc.length > 10 && desc.lastIndexOf("/")) {
				desc = desc.substring(desc.lastIndexOf("/") + 1, desc.length);
			}
			var src = element.src.replace("file://","http://");
			if (src.startsWith("//")) {
				src = "http:" + src;
			}
			
			imgDataArray.push({
				src : src,
				desc : desc
			});
		});
		// extract loadMoreUrl
		loadMoreUrl = myData.find(providerArray[providerIndex].moreSelector).attr('href');
		if (loadMoreUrl && !loadMoreUrl.startsWith("http")) {
			loadMoreUrl = providerArray[providerIndex].url + loadMoreUrl;
		}
		// display
		if (imgDataArray.length > imgDataIndex && $(CURRENT_DIV + " img").length === 0) {
			loadImg(CURRENT_DIV, imgDataIndex);
		}
		if (imgDataArray.length > imgDataIndex + 1 && $(OLDER_DIV + " img").length === 0) {
			loadImg(OLDER_DIV, imgDataIndex + 1);
		}
	}

	function loadStrips(url) {
		$.ajax({
			url : url,
			contentType : "text/html",
			mimeType : 'text/html',
			success : function(response) {
				extractImgSrc(response); // alert responce from query.php
				if (imgDataArray.length === 1 && loadMoreUrl) {
					//loaded exactly one Strip. Load Second now
					loadStrips(loadMoreUrl);
				}
			},
			error : function(xhr, ajaxOptions, thrownError) {
				alert("error: " + xhr);
			}
		});
	}

	function loadStripsInitially() {
		imgDataArray = [];
		imgDataIndex = 0;
		$(YOUNGER_DIV).empty();
		$(CURRENT_DIV).empty();
		$(OLDER_DIV).empty();
		loadStrips(providerArray[providerIndex].url);
	}
	
	// --------------- slide to next strip -----------------------
	function scrollStrip(direction) { // 1 = up, 0 = down
		currentAppStatus = STATUS_TRANSITION;
		var divToBeRemoved = (direction ? YOUNGER_DIV : OLDER_DIV);
		var divToCenterted = (direction ? OLDER_DIV : YOUNGER_DIV);
		// animations regadless of scroll direction
		// description
		$("#currentDesc").animate({
			opacity : ".0"
		}, 100, function() {
			refreshCurrentDesc();
			$("#currentDesc").animate({
				opacity : "1"
			}, 100);
		});
		// current
		$("#current img").animate({
			opacity : ".5"
		}, 290);
		// make current go away
		$("#current").animate({
			top : (direction ? -$("#current img").height() + (screenHeight / 10) + "px" : "90%")
		}, 290);

		// remove old
		$(divToBeRemoved).empty();

		// focus new
		$(divToCenterted + " img").animate({
			opacity : "1"
		}, 290);
		// if (direction === 0) {
		// $(divToCenterted).css('top', -$(divToCenterted).height() +
		// (screenHeight / 10) + "px");
		// }
		$(divToCenterted).animate({
			top : "20%"
		}, 300, function() {
			// persist
			$(divToBeRemoved).css('height', $("#current").height());
			$("#current").css('height', $(divToCenterted).height());
			$("#current img").appendTo(divToBeRemoved);
			$("#current").css('top', "20%");
			$(divToCenterted + " img").appendTo("#current");
			$(OLDER_DIV).css('top', "90%");
			// $(YOUNGER_DIV).css('top', "-80%");
			$(YOUNGER_DIV).css('top', -$(YOUNGER_DIV).height() + (screenHeight / 10) + "px");
			// $(YOUNGER_DIV).css('bottom', "90%");

			// scroll old back to start
			$(divToBeRemoved + " img").animate({
				left : "0px",
				top : "0px"
			}, 1000);

			// load new older
			if (direction && imgDataArray.length > imgDataIndex + 1) {
				loadImg(OLDER_DIV, imgDataIndex + 1);
			} else if (direction && loadMoreUrl) {
				loadStrips(loadMoreUrl);
			} else if (direction === 0 && imgDataIndex > 0) {
				loadImg(YOUNGER_DIV, imgDataIndex - 1);
			}
			currentAppStatus = STATUS_DISPLAY_STRIP;
		});

		resetImgState();
	}
	function scrollDown() {
		if (imgDataIndex === 0 || currentAppStatus === STATUS_TRANSITION) {
			// already at the top
			return;
		}
		imgDataIndex--;
		scrollStrip(0);
	}

	function scrollUp() {
		if (imgDataArray.length <= imgDataIndex + 1 || currentAppStatus === STATUS_TRANSITION) {
			// no more images
			return;
		}
		imgDataIndex++;
		scrollStrip(1);
	}
	
	function showMenu() {
		var options = $("#provider");
		options.val(providerIndex);
		$("#menu").removeClass('hide');
		currentAppStatus = STATUS_MENU;
	}
	// --------------- init -----------------------
	function onDeviceReady() {
		if (window.StatusBar) {
			StatusBar.overlaysWebView(false);
			StatusBar.styleDefault();
		}
		screenWidth = $(CURRENT_DIV).width();
		screenHeight = $(window).height();
		providerIndex = localStorage.getItem('providerIndex');
		
		// touch
		$('#current').bind('touchstart ', function(e) {
			onTouchStart(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY);
			e.preventDefault();
		}).bind('touchmove', function(e) {
			onTouchMove(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY);
		}).bind('touchend ', function(e) {
			var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
			onTouchEnd(touch.clientX, touch.clientY);
		// mouse
		}).bind(' mousedown', function(e) {
			onTouchStart(e.pageX, e.pageY);
			e.preventDefault();
		}).bind('mousemove', function(e) {
			if (touchStartX !== 0) {
				onTouchMove(e.pageX, e.pageY);
			}
		}).bind('mouseup', function(e) {
			onTouchEnd(e.pageX, e.pageY);
		});
		
		function isBodyTouchAllowed(x, y) {
			if ((currentAppStatus === STATUS_DISPLAY_STRIP || currentAppStatus === STATUS_TRANSITION) && (x > 50 || y > 50)) {
				return true;
			} 
			return false;
		}
		
		// touch swipe
		$(document).bind('touchstart', function(e){
		    if (isBodyTouchAllowed(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY)) {
				onBodyTouchStart(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY);
			    e.preventDefault();
		    }
		}).bind('touchmove', function(e){
			if (isBodyTouchAllowed(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY)) {
				e.preventDefault();
			}
		}).bind('touchend', function(e){
			var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
			if (isBodyTouchAllowed(touch.clientX, touch.clientY)) {
			    onBodyTouchEnd(touch.clientX, touch.clientY);
			    e.preventDefault();
			}
		});
		

		//click
		$(YOUNGER_DIV).bind('click', function(e){
		    scrollDown();
		    e.preventDefault();
		});
		$(OLDER_DIV).bind('click', function(e){
		    scrollUp();
		    e.preventDefault();
		});
		
		$("#menuButton").bind('click', function(e) {
			showMenu();
		});
		$("#menuOk").bind('click', function(e) {
			var newProviderIndex = $("#provider").val();
			if (newProviderIndex != -1) {
				$("#menu").addClass('hide');
				if (newProviderIndex != providerIndex) {
					currentAppStatus = STATUS_LOADING;
					providerIndex = newProviderIndex;
					localStorage.setItem('providerIndex', providerIndex);
					loadStripsInitially();
				} else {
					currentAppStatus = STATUS_DISPLAY_STRIP;
				}
				window.scrollTo(0, 0);
			}
		});
		
		//fill provider drop down
		var options = $("#provider");
		$.each(providerArray, function(i) {
		    options.append($("<option />").val(i).text(this.name));
		});
		
		//load strips
		if (providerIndex == null) {
			showMenu();
		} else {
			loadStripsInitially();
		}
	}

	$(document).ready(function() {
		if (window.cordova) {
			// on device with phonegap
			document.addEventListener("deviceready", onDeviceReady, false);
		} else {
			// in browser
			onDeviceReady();
		}
	});
}($));