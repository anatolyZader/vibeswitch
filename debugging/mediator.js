// @ai
// Mediator Pattern (GoF) - JavaScript realization
// Goal: Reduce coupling by having objects communicate via a mediator.

// @ai - Colleagues
class Meter {
    constructor(mediator) {
        this.mediator = mediator;
        this.value = 0;
    }
    setValue(v) {
        this.value = Math.max(0, Math.min(100, Number(v) || 0));
        this.mediator.notify(this, 'meter_changed', { value: this.value });
    }
}

class DebtList {
    constructor(mediator) {
        this.mediator = mediator;
        this.items = [];
    }
    add(file) {
        this.items.push(String(file));
        this.mediator.notify(this, 'debt_added', { file });
    }
    clear() {
        this.items = [];
        this.mediator.notify(this, 'debt_cleared', {});
    }
}

class StatusBar {
    constructor(mediator) {
        this.mediator = mediator;
        this.text = '';
    }
    setText(t) {
        this.text = t;
        console.log(`[StatusBar] ${this.text}`);
    }
}

// @ai - Mediator
class AwarenessUIMediator {
    constructor() {
        this.meter = null;
        this.debtList = null;
        this.statusBar = null;
    }

    wire({ meter, debtList, statusBar }) {
        this.meter = meter;
        this.debtList = debtList;
        this.statusBar = statusBar;
    }

    notify(sender, event, data) {
        if (!this.statusBar || !this.meter || !this.debtList) return;

        if (event === 'debt_added') {
            this.statusBar.setText(`Debt: ${this.debtList.items.length} file(s) | score=${this.meter.value}`);
        } else if (event === 'debt_cleared') {
            this.statusBar.setText(`Debt cleared | score=${this.meter.value}`);
        } else if (event === 'meter_changed') {
            this.statusBar.setText(`score=${data.value} | debt=${this.debtList.items.length}`);
        }
    }
}

// @ai - Demo
console.log('Mediator demo:');
const mediator = new AwarenessUIMediator();
const meter = new Meter(mediator);
const debt = new DebtList(mediator);
const bar = new StatusBar(mediator);
mediator.wire({ meter, debtList: debt, statusBar: bar });

debt.add('src/auth/login.ts');
meter.setValue(55);
debt.add('src/payments/charge.ts');
meter.setValue(70);
debt.clear();
