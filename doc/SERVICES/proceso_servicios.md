# Scrapping y proceso de servicios.

## Analisis completo de la funcionaldad y sus relaciones con los modulos existentes.

Bien. Ahora debemos resolver un problema persistente. Tal vez no estamos en la misma pagina. Pero. Una factura luego de identificar el origen (quie debe pagarla) y el destino (a quien hay que rendirle), tiene que generar los el asiento con las entradas debito y credito para las partes. Comprendes eso ??


Pasos (ejemplo)

Scrapping 
    Vincular factudas con la o las propiedades.
    Ubicar el origen y destino de los fondos que cubriran la factura.
        - origen: de donde sacas los fondos para pagarla.
            - Locador o locatario.
        - destino: a quien hay que rendirle los fondos
            - Locador o proveedor de servicios. 
Luego esos registros debe/haber aparecer el cada uno de los agentes disponible para cobrar o liquidar. 

