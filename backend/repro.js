import argon2 from "argon2";
import bcrypt from "bcryptjs";

async function test() {
    const password = "password123";
    const plainTextHash = "password123";

    console.log("Testing with argon2:");
    try {
        const result = await argon2.verify(plainTextHash, password);
        console.log("Result:", result);
    } catch (e) {
        console.log("Error:", e.message);
    }

    console.log("\nTesting with bcrypt:");
    try {
        const result = await bcrypt.compare(password, plainTextHash);
        console.log("Result:", result);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

test();
