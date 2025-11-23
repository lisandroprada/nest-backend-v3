A. Migración de clientes.
    1. ROL
        - Cliente no se convierte inmediatamente en PROPIETARIO.

    2. City, State (legacy)
        city: {
            id: { type: String }, [ ejemplo id: '06'] -> buscar en la coleccion localities el id que coincida con el id de la city. con eso extraes el _id y lo reemplazas.]
        },
        El mismo concepto utilizas con State. 

        - Debes buscar en las colecciones localities y provinces los _id que coincidan con el id de la city y state.
        - Una vez con los _id's puedes reemplazarlos en el nuevo schema.

    3. Genero
        - el campo legacy gender: { type: String, enum: ['Femenino', 'Masculino'] },
        debe convertirse en genero: @Prop({ type: String, enum: ['MASCULINO', 'FEMENINO', 'PERSONA_JURIDICA'] })
        - Nota que PERSONA_JURIDICA se cuando  (legacy) personType: { type: String, enum: ['Física', 'Jurídica'] } es Jurídica.

    4. agent legacy se relaciona con properties legacy y con leaseAgreements mediante el _id.
        Debes generar un legacy _id. En una nueva tabla o bien propone una solución alternativa.
        Para que luego la migración de las otras tablas puedan mantener la relación con agent legacy.
        Una solucion alternativa es simplemente importar el mismo _id actual. 

    5. Sugiere cualquier otra cosa que consideres necesaria. 


B. Migración de propiedades.
    - Puedes utlizar el _id legacy para la migración. (al igual que en clientes)
    - propertyModel-legacy.js -> property.entity.ts
    Establece la migración de propiedades.
    - Busca las caracteristicas comunes e intuye los campos que le corresponden. 

    1. Implementa una migración de los campos localities y provinces consistente con lo realizado en migracion de clientes.
    2. associatedServices (legacy) -> servicios_impuestos (new).
        - Debes migrar el _id de serviceCompany (es un _id correspondiente a agent legacy) y el resto de campos. (busca la consistencia)

        serviceCompany._id hace referencia a un agent._id (legacy). => proveedor_id
                LEGACY         =>  NEW
                "ratio": 25, => porcentaje_aplicacion
                "id": "0806500", => identificador_servicio
                "paymentSource": "Locatario" => origen (quien debe pagar)
                "paymentTarget": "Prestador" => destino (a quien se le paga)

        ejemplo legacy: 

                    {
            "_id": {
                "$oid": "606c3719c6213139a3d3b820"
            },
            "supplierId": [],
            "specs": null,
            "associatedServices": [
                {
                "serviceCompany": {
                    "city": null,
                    "state": null,
                    "consortiumDetails": [],
                    "phone": [
                    {
                        "number": ""
                    }
                    ],
                    "createdAt": "2021-04-14T08:04:05.017Z",
                    "_id": "607738de041f6605e326124b",
                    "name": "Cooperativa de Servicios",
                    "address": "",
                    "personType": "Jurídica",
                    "email": "info@cooprawson.com.ar",
                    "agentType": "Empresa de Servicios",
                    "lastName": "",
                    "fullName": "Cooperativa de Servicios ",
                    "bankAccount": [],
                    "gender": "Masculino",
                    "identityCard": null,
                    "supplierMask": "00-000-00",
                    "taxId": null,
                    "taxType": null
                },
                "ratio": 25,
                "id": "0806500",
                "paymentTarget": "Prestador",
                "paymentSource": "Locatario"
                },
                {
                "serviceCompany": {
                    "city": {
                    "id": "260112",
                    "nombre": "Rawson"
                    },
                    "state": {
                    "id": "26",
                    "nombre": "Chubut"
                    },
                    "consortiumDetails": [],
                    "phone": [
                    {
                        "number": ""
                    }
                    ],
                    "createdAt": "2021-02-15T23:57:30.341Z",
                    "_id": "602b36f9d9c61b619f0c61b8",
                    "name": "Camuzzi",
                    "lastName": "",
                    "address": "",
                    "email": "info@camuzzi.com",
                    "agentType": "Empresa de Servicios",
                    "fullName": "Camuzzi ",
                    "bankAccount": [],
                    "identityCard": null,
                    "supplierMask": "0000/0-0000-0000000/0",
                    "gender": "Masculino"
                },
                "ratio": 25,
                "id": "91030940600051068",
                "paymentTarget": "Prestador",
                "paymentSource": "Locatario"
                },
                {
                "serviceCompany": {
                    "city": {
                    "id": "260112",
                    "nombre": "Rawson"
                    },
                    "state": {
                    "id": "26",
                    "nombre": "Chubut"
                    },
                    "phone": [
                    {
                        "number": ""
                    }
                    ],
                    "createdAt": "2021-05-29T18:52:32.764Z",
                    "_id": "60b56658300fe2c2d38e5b62",
                    "consortiumDetails": [],
                    "name": "Municipalidad de Rawson",
                    "address": "",
                    "identityCard": "11111",
                    "personType": "Jurídica",
                    "email": "info@municipalidad.com.ar",
                    "agentType": "Empresa de Servicios",
                    "user": "602b3588d9c61b619f0c61b2",
                    "lastName": "",
                    "fullName": "Municipalidad de Rawson ",
                    "bankAccount": [],
                    "gender": "Femenino",
                    "supplierMask": "000000-000",
                    "taxId": null,
                    "taxType": null
                },
                "ratio": 100,
                "id": "003022000",
                "paymentTarget": "Prestador",
                "paymentSource": "Locador"
                }
            ],
            "img": null,
            "imgCover": null,
            "createdAt": null,
            "address": "Perito Moreno 240  Departamento 1",
            "owner": [
                {
                "_id": {
                    "$oid": "606c354bc6213139a3d3b81c"
                },
                "fullName": "Juan Carlos Matamala"
                }
            ],
            "inventory": [
                {
                "item": "Puerta de ingreso de chapa con ventana + cerradura y picaporte",
                "cantidad": 1,
                "ambiente": "Puerta de acceso",
                "estado": "Regular"
                },
                {
                "item": "Perchero de madera",
                "cantidad": 1,
                "ambiente": "Living comedor",
                "estado": "Regular"
                },
                {
                "item": "Ventana de aluminio con hoja que se abre + persiana",
                "cantidad": 1,
                "ambiente": "Living comedor",
                "estado": "Regular"
                },
                {
                "item": "Luminaria con foco",
                "cantidad": 1,
                "ambiente": "Living comedor",
                "estado": "Regular"
                },
                {
                "item": "Barra de ladrillo y madera con estantes ",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Mesada doble de granito con bacha + griferia monocomando",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Bajo mesada de 3 puertas + 3 cajones + sifon y flexibles de la bacha",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Conexión al lavarropas ",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Regular"
                },
                {
                "item": "Termotanque \"Señorial\" de 80 Litros ",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Regular"
                },
                {
                "item": "Azulejos blancos con detalles ",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Luminaria plafon led",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Estante blanco",
                "cantidad": 1,
                "ambiente": "Cocina",
                "estado": "Bueno"
                },
                {
                "item": "Calorama marca \"Coppens\" ",
                "cantidad": 1,
                "ambiente": "Pasillo",
                "estado": "Bueno"
                },
                {
                "item": "Puerta de madera + cerradura y picaporte",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Usado"
                },
                {
                "item": "Inodoro con mochila con correa",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Regular"
                },
                {
                "item": "Bidet + griferia",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Regular"
                },
                {
                "item": "Lavamanos con pie + griferia",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Regular"
                },
                {
                "item": "Botiquín de 3 puertas con espejos",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Usado"
                },
                {
                "item": "Ducha + Griferia",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Regular"
                },
                {
                "item": "Accesorios, porta papel higiénico, jabonera, toallero, vaso para cepillos,",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Bueno"
                },
                {
                "item": "Piso de cerámico + azulejos color gris/blanco",
                "cantidad": 1,
                "ambiente": "Baño",
                "estado": "Bueno"
                },
                {
                "item": "Puerta de madera + cerradura y picaporte",
                "cantidad": 1,
                "ambiente": "Dormitorio",
                "estado": "Regular"
                },
                {
                "item": "Paclard de 6 puertas + 2 cajones con estantes y perchero",
                "cantidad": 1,
                "ambiente": "Dormitorio",
                "estado": "Usado"
                }
            ],
            "description": [
                {
                "ambiente": "Cocina",
                "cantidad": 1
                },
                {
                "ambiente": "Living, Comedor",
                "cantidad": 1
                },
                {
                "ambiente": "Dormitorio",
                "cantidad": 1
                },
                {
                "ambiente": "Baño",
                "cantidad": 1
                },
                {
                "ambiente": "Patio",
                "cantidad": 1
                }
            ],
            "__v": 0,
            "active": true,
            "city": {
                "id": "260112",
                "nombre": "Rawson"
            },
            "state": {
                "id": "26",
                "nombre": "Chubut"
            },
            "availableAt": {
                "$date": "2026-03-11T15:26:34.000Z"
            },
            "leaseAgreement": {
                "$oid": "65f1c5e1ea343e040cbd2d4e"
            },
            "tenant": {
                "_id": {
                "$oid": "609535588450740549fee9e7"
                },
                "fullName": "Adrian Ezequiel Arancibia"
            },
            "detailedDescription": {
                "availableServices": [],
                "locations": [],
                "miscellaneous": []
            },
            "valueForRent": {
                "date": {
                "$date": "2024-03-11T09:43:10.829Z"
                }
            },
            "valueForSale": {
                "date": {
                "$date": "2024-03-11T09:43:10.829Z"
                }
            },
            "consortium": {
                "_id": null,
                "fullName": null
            },
            "expensesType": {
                "_id": null,
                "expenseName": null
            }
            }

