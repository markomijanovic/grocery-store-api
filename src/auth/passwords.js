import argon2, { verify } from 'argon2'
export function createPasswordHasher(){
    return{
        hash: password => argon2.hash(password,{
            type: argon2.argon2id,
            memoryCost:19456,
            timeCost: 2,
            parallelism: 1,
        }),

        verify: (hash, password) => argon2.verify(hash,password),
    };
}