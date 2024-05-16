-- public."user" definition

-- Drop table

-- DROP TABLE public."user";

CREATE TABLE public."user" (
	id serial4 NOT NULL,
	discord_user_id varchar NOT NULL,
	discord_username varchar NOT NULL,
	created_timestamp timestamp NOT NULL,
	updated_timestamp timestamp NULL,
	is_bot bool NOT NULL,
	CONSTRAINT user_pk PRIMARY KEY (id),
	CONSTRAINT user_unique UNIQUE (discord_user_id)
);


-- public.thread definition

-- Drop table

-- DROP TABLE public.thread;

CREATE TABLE public.thread (
	id serial4 NOT NULL,
	discord_thread_id varchar NOT NULL,
	openai_thread_id varchar NULL,
	user_id int4 NOT NULL,
	created_timestamp timestamp NOT NULL,
	updated_timestamp timestamp NULL,
	is_deleted bool DEFAULT false NOT NULL,
	has_reached_max_quota bool DEFAULT false NOT NULL,
	CONSTRAINT disrcord_thread_unique UNIQUE (discord_thread_id),
	CONSTRAINT openai_thread_unique UNIQUE (openai_thread_id),
	CONSTRAINT thread_pk PRIMARY KEY (id),
	CONSTRAINT thread_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id)
);


-- public.message definition

-- Drop table

-- DROP TABLE public.message;

CREATE TABLE public.message (
	id serial4 NOT NULL,
	user_id int4 NOT NULL,
	message varchar NOT NULL,
	thread_id int4 NOT NULL,
	created_timestamp timestamp NOT NULL,
	updated_timestamp timestamp NULL,
	CONSTRAINT message_pk PRIMARY KEY (id),
	CONSTRAINT message_thread_fk FOREIGN KEY (thread_id) REFERENCES public.thread(id),
	CONSTRAINT message_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id)
);