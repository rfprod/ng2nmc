import { Component, OnInit, ElementRef, OnDestroy } from '@angular/core';

import { EventEmitterService } from '../services/event-emitter.service';
import { TranslateService } from '../translate/index';

@Component({
	selector: 'app-nav',
	templateUrl: '/public/app/views/app-nav.html',
})
export class AppNavComponent implements OnInit, OnDestroy {

	constructor(
		private el: ElementRef,
		private emitter: EventEmitterService,
		private translate: TranslateService
	) {}

	private subscription: any;

	public navButtonsState: boolean[] = [false, false, false, false];

	public supportedLanguages: any[];

	public switchNavButtons(event, isClick: boolean): void {
		let route, index;
		console.log('switchNavButtons:', event);
		if (isClick) {
			if (event.target.localName === 'i') {
				route = event.target.parentElement.href;
			} else { route = event.target.href; }
		} else { route = event.route; }
		const path = route.substring(route.lastIndexOf('/') + 1, route.length);
		console.log(' >> PATH', path);
		if (path === 'intro') {
			index = '1';
		} else if (path === 'login') {
			index = '2';
		} else if (path === 'data') {
			index = '3';
		} else {
			index = '0';
		}
		for (const b in this.navButtonsState) {
			if (b === index) { this.navButtonsState[b] = true; } else { this.navButtonsState[b] = false; }
		}
		console.log('navButtonsState:', this.navButtonsState);
	}

	public stopWS(): void {
		/*
		*	this function should be executed before user is sent to any external resource
		*	on click on an anchor object if a resource is loaded in the same tab
		*/
		console.log('close websocket event emitted');
		this.emitter.emitEvent({ websocket: 'close' });
	}

	public selectLanguage(key: string): void {
		this.emitter.emitEvent({ lang: key });
	}
	public isLanguageSelected(key: string): boolean {
		return key === this.translate.currentLanguage;
	}

	public ngOnInit(): void {
		console.log('ngOnInit: AppNavComponent initialized');

		// check active route on app init - app-nav loads once on app init
		this.subscription = this.emitter.getEmitter().subscribe((message) => {
			console.log('/app-nav consuming event:', message);
			if (typeof message.route !== 'undefined') {
				console.log('route is defined');
				this.switchNavButtons(message, false);
				this.subscription.unsubscribe();
			}
		});

		// init supported languages
		this.supportedLanguages = [
			{ key: 'en', name: 'English' },
			{ key: 'ru', name: 'Russian' }
		];
	}

	public ngOnDestroy(): void {
		console.log('ngOnDestroy: AppNavComponent destroyed');
	}
}
