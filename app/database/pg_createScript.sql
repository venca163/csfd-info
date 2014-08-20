DROP TABLE IF EXISTS CsfdUser;

CREATE TABLE CsfdUser
(
    id              serial primary key,
    csfdId          integer UNIQUE NOT NULL,
    lastReq         integer,
    lastRatingsNum  smallint,
    reqCount        integer,
    ratings	    json
);



-- CREATE TABLE CsfdUser (id serial primary key, csfdId integer,lastReq integer,lastRatingsNum smallint,reqCount integer,ratings json);



