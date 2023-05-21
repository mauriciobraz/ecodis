## Como ligar

-   [PNPM](https://pnpm.js.org/) é necessário para instalar as dependências.
-   [Node.js](https://nodejs.org/en/) é necessário para executar o bot.
-   [MongoDB](https://www.mongodb.com/try/download/community)

```bash
# Instala as dependências
pnpm install

# Compila o código
pnpm tsup

# Inicia o bot
node dist/index.js
```

## Banco de dados

-   [Usando Mongo Atlas](https://www.prisma.io/dataguide/mongodb/mongodb-atlas-setup)
-   [Docker (avançado)](https://haneenmahdin.medium.com/set-up-mongodb-prisma-with-docker-c8c2f28e85de)

## Diretórios

-   `@types` - Tipagens globais do TypeScript.
-   `assets` - Arquivos de mídia (emojis, farm, estufa...)
-   `source`

    -   `index.ts` - Arquivo de inicialização do bot.
    -   `jobs` - Diretório com scripts que rodam em intervalos de tempo.
    -   `modules` - Diretório com os módulos (comandos e eventos) do bot.
        -   `admin`
        -   `core`
        -   `doctor`
        -   `editor`
        -   `games`
        -   `money`
        -   `others`
        -   `owners`
        -   `vet`
    -   `preconditions` - Arquivos de precondições (guards) de comandos.
        -   `DoctorOnly.ts` - Checa se o usuário é um médico.
        -   `EditorOnly.ts` - Checa se o usuário é um editor.
        -   `NotArrested.ts` - Checa se o usuário não está preso.
        -   `NotBlacklisted.ts` - Checa se um comando não está na blacklist.
        -   `OnlyOwners.ts` - Checa se o usuário é um dos donos do bot.
        -   `VetOnly.ts` - Checa se o usuário é um veterinário.
    -   `utils` - Arquivos de utilidades do bot.

        -   `animals.ts` - Onde os animais são criados, mude nome/emoji aqui.
        -   `items.ts` - Arquivo onde os itens são criados, mude nome/emoji aqui.

        -   `farm.ts` - Arquivo de utilidades da fazenda.
        -   `greenhouse.ts` - Arquivo de utilidades da estufa.

        -   `fs-utils.ts` - Arquivo de utilidades do fs.

        -   `discordjs.ts` - Arquivo de utilidades do Discord.js.
        -   `shop.ts` - Arquivo de utilidades de queries da loja.
        -   `user.ts` - Arquivo de utilidades de queries do usuário.
