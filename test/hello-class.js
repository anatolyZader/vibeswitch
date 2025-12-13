// Class-based approach
class Greeter {
    constructor(message = "Hello World!") {
        this.message = message;
    }
    
    greet() {
        console.log(this.message);
    }
}

const greeter = new Greeter();
greeter.greet();

